import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 100, 
    message: 'Too many login attempts from this IP, please try again after an hour',
    standardHeaders: true, 
    legacyHeaders: false, 
});

