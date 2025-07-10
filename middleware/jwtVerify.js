import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(" ")[1];
        console.log("--- jwtVerify Middleware ---"); 
        console.log("Token received:", token); 

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                console.error("JWT verification failed:", err.message); 
                return res.status(403).json({ message: "Invalid or expired token" });
            }
            console.log("Decoded JWT payload:", decoded); 
            console.log("Decoded userId from payload:", decoded.userId); 
            req.userId = decoded.userId; 
            console.log("req.userId set to:", req.userId); 
            next();
        });
    } else {
        console.log("No Authorization header provided."); 
        return res.status(401).json({ message: "No token provided" });
    }
};