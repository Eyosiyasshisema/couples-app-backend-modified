export const checkPasswordComplexity = (req, res, next) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: "Password is required" });
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const minLength = 8;

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar || password.length < minLength) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.",
            error: "password_complexity",
        });
    }

    next(); 
}