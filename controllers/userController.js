import bcrypt from "bcrypt";
import {query} from "../db.js";
import jwt from "jsonwebtoken"; 
import { validationResult } from 'express-validator';
import {handleDatabaseError,handleHashingError,handleGeneralError,emailNotFound,errorUpdatingUserProfile} from "../utils/errorHandlers.js"
import { v4 as uuidv4 } from "uuid";

export const registerUser=async (req,res)=>{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { username,email, password, fullName, gender, dateOfBirth } = req.body;
    const saltRounds=10;
    try{
    const checkResult= await query("SELECT email FROM users WHERE email=$1",[email])
        if(checkResult.rows.length > 0){
            return res.status(409).json({ success: false, message: "Email already exists", error: "email_exists" }); 
        } else {
            bcrypt.hash(password,saltRounds, async (err,hashedPassword)=>{
                if(err){
                   handleHashingError(res,err);
                } else{
                    try {
                        await query("INSERT INTO users (username,email,password,full_name,gender,date_of_birth) VALUES ($1,$2,$3,$4,$5,$6)",
                            [username,email, hashedPassword, fullName, gender, dateOfBirth])
                            return res.status(201).json({success: true, message: "user created"});
                    } catch (dbError) {
                       handleDatabaseError(res,dbError)
                    }
                }
            })
        }
    } catch (error) { 
       return handleGeneralError(res,error)
    }
}

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const checkResult = await query("SELECT email FROM users WHERE email = $1", [email]);
        if (checkResult.rows.length > 0) {
            try {
                const result = await query("SELECT * from users WHERE email = $1", [email]);
                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    const hashedPassword = user.password;
                    bcrypt.compare(password, hashedPassword, (err, isMatch) => {
                        if (err) {
                            return handleGeneralError(res, err);
                        }
                        if (isMatch) {
                            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
                            const refreshToken = uuidv4()
                            try {
                               query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id]);
                                return res.status(200).json({
                                    success: true,
                                    message: "Login successful",
                                    token,
                                    refreshToken,
                                    userId: user.id,
                                    username: user.username,
                                    email: user.email
                                });
                            } catch (dbError) {
                                return handleDatabaseError(res, dbError);
                            }
                        } else {
                            return res.status(401).json({ success: false, message: "Invalid credentials", error: "incorrect_password" });
                        }
                    });
                }
            } catch (error) {
                return handleGeneralError(res, error);
            }
        } else {
            return emailNotFound(res, "Email not found during login");
        }
    } catch (error) {
        return handleGeneralError(res, error);
    }
};

export const getUserProfile = async (req,res)=>{
   const userId = req.userId;
   try {
    const result = await query ("SELECT id, username, email, full_name, gender, date_of_birth FROM users WHERE id = $1",[userId]);
    const user= result.rows[0];
    if (result.rows.length==1){
        return res.status(200).json({
          user: user,
          success: true, message: "profile successfully displayed"});
    }
    else {
        return res.status(404).json({ success: false, message: "User not found" });
    }
   } catch (error) {
   return handleDatabaseError(res,error);
   }
}

export const updateUserProfile = async (req,res)=>{
    try {
        const userId= req.userId;
        const {username, fullName , gender}= req.body;
        const updatedFields= [];
        const values= [];
        let paramIndex= 1;
        if(username!== undefined){
            updatedFields.push(`username= $${paramIndex++}`);
            values.push(username);
        }
        if(fullName!== undefined){
            updatedFields.push(`full_name= $${paramIndex++}`);
            values.push(fullName);
        }
        if(gender!== undefined){
            updatedFields.push(`gender= $${paramIndex++}`);
            values.push(gender);
        }
        if (updatedFields.length === 0) {
            return res.status(200).json({ success: true, message: "No profile updates provided" });
        }
        values.push(userId);
        const queryText = `
        UPDATE users
        SET ${updatedFields.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, username, email, full_name, gender,  date_of_birth;
    `;

    const result = await query(queryText, values);

    if (result.rows.length === 1) {
        return res.status(200).json({ success: true, message: "Profile updated successfully", user: result.rows[0] });
    } else {
        return res.status(404).json({ success: false, message: "User not found" });
    }
        
    } catch (error) {
      return  errorUpdatingUserProfile(res,error);
    }
}
export const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;
        const saltRounds = 10;
        const result = await query("SELECT password FROM users WHERE id = $1", [userId]);

        if (result.rows.length === 1) {
            const hashedPassword = result.rows[0].password;

            const passwordMatch = await bcrypt.compare(currentPassword, hashedPassword);

            if (passwordMatch) {
                if (newPassword !== undefined && newPassword.trim() !== "") {
                    bcrypt.hash(newPassword, saltRounds, async (hashErr, newHashedPassword) => {
                        if (hashErr) {
                            return handleHashingError(res, hashErr);
                        } else {
                            try {
                                const updateResult = await query(
                                    "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, full_name, gender,  date_of_birth",
                                    [newHashedPassword, userId]
                                );
                                if (updateResult.rows.length === 1) {
                                    return res.status(200).json({ success: true, message: "Password changed successfully", user: updateResult.rows[0] });
                                } else {
                                    return res.status(404).json({ success: false, message: "User not found" }); 
                                }
                            } catch (dbError) {
                                return handleDatabaseError(res, dbError);
                            }
                        }
                    });
                } else {
                    return res.status(400).json({ success: false, message: "New password cannot be empty" });
                }
            } else {
                return res.status(401).json({ success: false, message: "Incorrect current password" });
            }
        } else {
            return res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (error) {
        return errorUpdatingUserProfile(res, error);
    }
};

export const logoutUser = async (req, res) => {
    const userId = req.userId; 

    try {
        const result = await query("UPDATE users SET refresh_token = NULL WHERE id = $1", [userId]);

        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: "Logout successful" });
        } else {
            return res.status(404).json({ success: false, message: "User not found or no refresh token to clear" });
        }
    } catch (error) {
        return handleDatabaseError(res, error);
    }
};
