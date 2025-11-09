import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "./config.env" });

//  Middleware to authenticate company using JWT
export const authCompany = async (req, res, next) => {
    try {
        // Get token from Authorization header → "Bearer <token>"
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Access Denied! Token not provided." });
        }

        const token = authHeader.split(" ")[1];

        // Verify token using secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

        // Attach company info to request for next middlewares/controllers
        req.company = decoded;

        next(); //  Proceed to next step
    } catch (err) {
        console.error("AuthCompany Error:", err);
        return res.status(401).json({ message: "Invalid or expired token!", error: err.message });
    }
};