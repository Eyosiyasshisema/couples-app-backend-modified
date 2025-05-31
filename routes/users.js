import express from "express";
import * as userController from "../controllers/userController.js";
import { validateRegistration } from "../middleware/validationMiddleware.js";
import { verifyToken } from "../middleware/jwtVerify.js"; 
import { checkPasswordComplexity } from "../middleware/passwordComplexityMiddleware.js"
import { loginLimiter } from "../middleware/rateLimitMiddleware.js";

const usersRouter = express.Router(); 

usersRouter.post("/register", validateRegistration, checkPasswordComplexity,userController.registerUser);
usersRouter.post("/login", loginLimiter,userController.loginUser);
usersRouter.get("/profile", verifyToken, userController.getUserProfile);
usersRouter.put("/profile", verifyToken, userController.updateUserProfile);
usersRouter.post("/change-password",verifyToken, checkPasswordComplexity, userController.changePassword);
usersRouter.post("/logout", verifyToken, userController.logoutUser);

export default usersRouter; 