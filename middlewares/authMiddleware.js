const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const LoginSession = require("../models/loginSessionModel");

dotenv.config();

const authMiddleware = async (req, res, next) => {
    try {

        // -----------------------------------
        // GET TOKEN
        // -----------------------------------

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "No token provided"
            });
        }

        const token = authHeader.split(" ")[1];

        // -----------------------------------
        // VERIFY JWT
        // -----------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // -----------------------------------
        // CHECK DATABASE SESSION
        // -----------------------------------

        const session =
            await LoginSession.getActiveLoginSession(token);

        if (!session) {
            return res.status(401).json({
                message: "Session expired",
                code: "SESSION_EXPIRED"
            });
        }

        // -----------------------------------
        // EXTEND SESSION BY 30 DAYS
        // -----------------------------------

        const newExpiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );

        await LoginSession.updateLoginSessionExpiry(
            token,
            newExpiresAt
        );

        // -----------------------------------
        // ATTACH USER INFORMATION
        // -----------------------------------

        req.user = decoded;

        next();

    } catch (error) {

        // JWT expired
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired",
                code: "TOKEN_EXPIRED"
            });
        }

        console.error(
            "Auth middleware error:",
            error
        );

        return res.status(401).json({
            message: "Invalid token",
            code: "INVALID_TOKEN"
        });
    }
};

module.exports = {
    authMiddleware
};