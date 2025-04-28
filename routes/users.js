import express from "express";
import * as userController from "../controllers/userController.js";
import { validateRegistration } from "../middleware/validationMiddleware.js";
import { verifyToken,checkPasswordComplexity,loginLimiter} from "../middleware/jwtVerify.js";

const usersRouter = express.Router(); 

usersRouter.post("/register", validateRegistration, checkPasswordComplexity,userController.registerUser);
usersRouter.post("/login", loginLimiter,userController.loginUser);
usersRouter.get("/profile", verifyToken, userController.getUserProfile);
usersRouter.put("/profile", verifyToken, userController.updateUserProfile);
usersRouter.post("/change-password",verifyToken, checkPasswordComplexity, userController.changePassword);
usersRouter.post("/logout", verifyToken, userController.logoutUser);

export default usersRouter; 