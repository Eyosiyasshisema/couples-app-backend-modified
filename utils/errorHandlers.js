export const handleDatabaseError=(res,dbError)=>{
    console.error("Database error",dbError)
    return res.status(500).json({ success: false, message: "Internal server error", error: "database_error" }); 
}

export const handleHashingError =(res,err)=>{
    console.error("Error hashing password",err)
    return res.status(500).json({success:false, message:"internal server error",error:"hashing_error"})
}

export const handleGeneralError =(res,error)=>{
    console.error("General error", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: "general_error" });   
}

export const emailNotFound=(res,error)=>{
     console.error("bad request",error)
        return res.status(409).json({success:false,message:"email doesnt exist, try registering",error:"email doesnt exist"});
}

export const errorUpdatingUserProfile=(res,error)=>{
    console.error('Error updating user profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
}