const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const LoginSession = require("../models/loginSessionModel");

dotenv.config();

const authMiddleware = async (req, res, next) => {
    try {

        // -----------------------------------
        // GET AUTHORIZATION HEADER
        // -----------------------------------

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "No token provided",
                code: "NO_TOKEN"
            });
        }

        // -----------------------------------
        // GET TOKEN
        // -----------------------------------

        const token = authHeader.split(" ")[1];

        // -----------------------------------
        // VERIFY JWT
        // -----------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // -----------------------------------
        // CHECK ACTIVE DATABASE SESSION
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
        // UPDATE SLIDING SESSION EXPIRY
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

        // Attach session information if required later
        req.session = session;

        next();

    } catch (error) {

        // -----------------------------------
        // JWT EXPIRED
        // -----------------------------------

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Session expired",
                code: "SESSION_EXPIRED"
            });
        }

        // -----------------------------------
        // INVALID JWT
        // -----------------------------------

        return res.status(401).json({
            message: "Invalid token",
            code: "INVALID_TOKEN"
        });
    }
};

module.exports = {
    authMiddleware
};