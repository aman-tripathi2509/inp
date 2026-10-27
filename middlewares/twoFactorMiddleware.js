const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const twoFactorMiddleware = (req, res, next) => {
    try {

        // -----------------------------------
        // GET TOKEN
        // -----------------------------------

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Two-factor token is required"
            });
        }

        const token = authHeader.split(" ")[1];

        // -----------------------------------
        // VERIFY TEMPORARY 2FA JWT
        // -----------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // -----------------------------------
        // CHECK TOKEN PURPOSE
        // -----------------------------------

        if (decoded.purpose !== "2FA_LOGIN") {
            return res.status(401).json({
                success: false,
                message: "Invalid two-factor authentication token"
            });
        }

        // -----------------------------------
        // ATTACH USER INFORMATION
        // -----------------------------------

        req.user = decoded;

        next();

    } catch (error) {

        // -----------------------------------
        // JWT EXPIRED
        // -----------------------------------

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Two-factor session expired",
                code: "TWO_FACTOR_TOKEN_EXPIRED"
            });
        }

        console.error(
            "Two-factor middleware error:",
            error
        );

        return res.status(401).json({
            success: false,
            message: "Invalid two-factor authentication token",
            code: "INVALID_TWO_FACTOR_TOKEN"
        });
    }
};

module.exports = {
    twoFactorMiddleware
};