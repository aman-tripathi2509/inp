const express = require("express");
const router = express.Router();
const { signup,
        login,
        verifyTwoFactorLogin,
        verifyEmail,
        getUserDetail,
        uploadProfilePhoto,
        update_UserData,
        changePassword,
        requestPasswordResetOTP,
        verifyPasswordResetOTP,
        forgotPassword,
        resetPassword,
        
        HighestEducation,
        getStates,
        WorkStatus,
        PrimaryProfession,
        TotalWorkEx,
        SeniorityLevel,
        WorkExCurrentCompany,
        BusinessModel,
        CompanyType,
        FetchYears,
        FetchHouseholdIncome,
        FetchEmployementStatus,
        FetchDepartment,
        FetchFunction,

        checkReferral,
        signupRequest,
        
        getTwoFactorStatus,
        setupTwoFactor,
        verifyTwoFactor,
        disableTwoFactorOTP,
        disableTwoFactor,
        getActiveDevices,
        logoutDevice,
        logoutAllDevices,
        getLoginActivity,
        getAllSkills
} = require("../controllers/userController");  // Import both functions

const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware
const profileUpload = require("../middlewares/profileUpload");
const { twoFactorMiddleware } = require("../middlewares/twoFactorMiddleware");
// const { userLoginLimiter } = require("../middlewares/loginRateLimiter");
// const { forgotPasswordLimiter } = require("../middlewares/forgotPasswordRateLimiter");
const { userLoginLimiter,forgotPasswordLimiter,otpRequestLimiter,otpVerifyLimiter,signupLimiter,signupIpLimiter,signupRequestIpLimiter,signupRequestLimiter } = require("../middlewares/rateLimiters");

// Signup Route
// router.post("/signup", signup);

router.post("/check-referral", checkReferral);     // frontend calls this first to decide which form to show

// router.post("/signup", signup);
router.post("/signup", signupLimiter,signupIpLimiter, signup);

// router.post("/signup-request", signupRequest);     // no referral — goes to pending queue
router.post("/signup-request", signupRequestIpLimiter,signupRequestLimiter, signupRequest );

// Login Route
// router.post("/login", userLoginLimiter, login);
router.post("/login", userLoginLimiter, login);

// Forgot Password
// router.post(
//     "/forgot-password",
//     forgotPasswordLimiter,
//     forgotPassword
// );


// router.post(
//     "/set-password/request-otp",
//     requestPasswordResetOTP
// );

// router.post(
//     "/set-password/verify-otp",
//     verifyPasswordResetOTP
// );

// Forgot Password
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);

router.post("/set-password/request-otp", otpRequestLimiter, requestPasswordResetOTP);

router.post("/set-password/verify-otp", otpVerifyLimiter, verifyPasswordResetOTP );

// RESET Password
router.post(
    "/set-password",
    resetPassword
);

router.post(
    "/2fa/login",
    twoFactorMiddleware,
    verifyTwoFactorLogin
);

router.get("/verify-email", verifyEmail);

// Fetch Single User
router.post(
    "/fetch-user",
    authMiddleware,
    getUserDetail
);

router.post(
    "/upload-profile-photo",
    authMiddleware,
    profileUpload.single("profile_photo"),
    uploadProfilePhoto
);

router.post('/update-user',authMiddleware,update_UserData);

router.post(
    "/change-password",
    authMiddleware,
    changePassword
);

router.get(
    "/2fa/status",
    authMiddleware,
    getTwoFactorStatus
);

router.post(
    "/2fa/setup",
    authMiddleware,
    setupTwoFactor
);

router.post(
    "/2fa/verify",
    authMiddleware,
    verifyTwoFactor
);

router.post(
    "/2fa/disable_2fa_otp",
    authMiddleware,
    disableTwoFactorOTP
);

router.post(
    "/2fa/disable_2fa",
    authMiddleware,
    disableTwoFactor
);

router.get(
    "/login-activity",
    authMiddleware,
    getLoginActivity
);


router.get(
    "/active-devices",
    authMiddleware,
    getActiveDevices
);

router.post(
    "/logout-device",
    authMiddleware,
    logoutDevice
);

router.post(
    "/logout-all-devices",
    authMiddleware,
    logoutAllDevices
);


router.post('/highest-education',authMiddleware,HighestEducation);
router.post('/get-states',authMiddleware,getStates);
router.post("/work-status", authMiddleware, WorkStatus);
router.post("/primary-profession", authMiddleware, PrimaryProfession);
router.post("/total-work-ex", authMiddleware, TotalWorkEx);
router.post("/seniority-level", authMiddleware, SeniorityLevel);
router.post("/Work-Ex-Current-Company", authMiddleware, WorkExCurrentCompany);
router.post("/business-model", authMiddleware, BusinessModel);
router.post("/company-type", authMiddleware, CompanyType);
router.post("/years", authMiddleware, FetchYears);
router.post("/household-income", authMiddleware, FetchHouseholdIncome);
router.post("/employement-status", authMiddleware, FetchEmployementStatus);
router.post("/department", authMiddleware, FetchDepartment);
router.post("/function", authMiddleware, FetchFunction);
router.get("/skills", authMiddleware, getAllSkills);
// Export the router
module.exports = router;
