import { body, validationResult } from "express-validator";
export const validateRegistration = [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Invalid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("gender").optional().isIn(["male", "female", "other"]).withMessage("Invalid gender"),
    body("school").trim().notEmpty().withMessage("School is required"),
    body("dateOfBirth").isISO8601().withMessage("Invalid date of birth"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];