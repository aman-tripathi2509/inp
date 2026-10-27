const {
    rateLimit,
    ipKeyGenerator
} = require("express-rate-limit");


// =====================================================
// COMMON HELPERS
// =====================================================

const normalizeValue = (value) => {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();

    return normalized || "missing-identifier";
};


// =====================================================
// LOGIN RATE LIMITER
// =====================================================

const createLoginLimiter = (accountField) => rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    skipSuccessfulRequests: true,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);

        const accountIdentifier = normalizeValue(
            req.body?.[accountField]
        );

        return `${ipAddress}:${accountIdentifier}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many login attempts. Please try again later."
        });
    }
});


// User login
const userLoginLimiter = createLoginLimiter("useremail");

// Admin login
const adminLoginLimiter = createLoginLimiter("username");


// =====================================================
// FORGOT PASSWORD RATE LIMITER
// =====================================================

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);

        const email = normalizeValue(
            req.body?.email
        );

        return `${ipAddress}:${email}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many password reset requests. Please try again later."
        });
    }
});


// =====================================================
// OTP REQUEST RATE LIMITER
// =====================================================

const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,

    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);

        const token = normalizeValue(
            req.body?.token
        );

        return `${ipAddress}:${token}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many OTP requests. Please try again later."
        });
    }
});


// =====================================================
// OTP VERIFY RATE LIMITER
// =====================================================

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);

        const token = normalizeValue(
            req.body?.token
        );

        return `${ipAddress}:${token}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many OTP verification attempts. Please try again later."
        });
    }
});


// =====================================================
// SIGNUP RATE LIMITER
// =====================================================

const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,

    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);

        const email = normalizeValue(
            req.body?.email
        );

        return `${ipAddress}:${email}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many signup attempts. Please try again later."
        });
    }
});

const signupIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        return ipKeyGenerator(req.ip);
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many signup attempts. Please try again later."
        });
    }
});


const signupRequestIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        return ipKeyGenerator(req.ip);
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many membership requests. Please try again later."
        });
    }
});

const signupRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const ipAddress = ipKeyGenerator(req.ip);
        const email = normalizeValue(req.body?.email);

        return `${ipAddress}:${email}`;
    },

    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: "Too many membership requests. Please try again later."
        });
    }
});

module.exports = {
    userLoginLimiter,
    adminLoginLimiter,
    forgotPasswordLimiter,
    otpRequestLimiter,
    otpVerifyLimiter,
    signupLimiter,
    signupIpLimiter,
    signupRequestIpLimiter,
    signupRequestLimiter
};