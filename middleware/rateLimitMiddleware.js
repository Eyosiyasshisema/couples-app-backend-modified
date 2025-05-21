import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 100, // Max 100 login attempts per IP in the window
    message: 'Too many login attempts from this IP, please try again after an hour',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// In your routes file:
import { loginUser } from './userControllers.js';

router.post('/login', loginLimiter, loginUser);