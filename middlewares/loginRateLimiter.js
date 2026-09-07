const {
    rateLimit,
    ipKeyGenerator
} = require("express-rate-limit");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LIMIT_EXCEEDED_RESPONSE = {
    message: "Too many login attempts. Please try again later."
};

const normalizeAccountIdentifier = (value) => {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();

    return normalized || "missing-account-identifier";
};

const createLoginLimiter = (accountField) => rateLimit({
    windowMs: WINDOW_MS,
    max: MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);
        const accountIdentifier = normalizeAccountIdentifier(
            req.body?.[accountField]
        );

        return `${ipAddress}:${accountIdentifier}`;
    },
    handler: (req, res) => {
        res.status(429).json(LIMIT_EXCEEDED_RESPONSE);
    }
});

const userLoginLimiter = createLoginLimiter("useremail");
const adminLoginLimiter = createLoginLimiter("username");

module.exports = {
    userLoginLimiter,
    adminLoginLimiter
};
