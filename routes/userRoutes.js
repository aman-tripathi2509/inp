const express = require("express");
const router = express.Router();
const { signup,
        login,
        verifyTwoFactorLogin,
        getUserDetail,
        uploadProfilePhoto,
        update_UserData,
        changePassword,
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
        CompanyRevenue,
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
        getActiveDevices,
        logoutDevice,
        logoutAllDevices,
        getLoginActivity} = require("../controllers/userController");  // Import both functions

const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware
const profileUpload = require("../middlewares/profileUpload");
const { userLoginLimiter } = require("../middlewares/loginRateLimiter");

// Signup Route
// router.post("/signup", signup);
router.post("/check-referral", checkReferral);     // frontend calls this first to decide which form to show
router.post("/signup", signup);                    // referral path — creates account immediately
router.post("/signup-request", signupRequest);     // no referral — goes to pending queue
// Login Route
router.post("/login", userLoginLimiter, login);    // Use `/login` for authentication

// Forgot Password
router.post(
    "/forgot-password",
    forgotPassword
);

// RESET Password
router.post(
    "/reset-password",
    resetPassword
);

router.post(
    "/2fa/login",
    authMiddleware,
    verifyTwoFactorLogin
);

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
router.post("/company-revenue", authMiddleware, CompanyRevenue);
router.post("/company-type", authMiddleware, CompanyType);
router.post("/years", authMiddleware, FetchYears);
router.post("/household-income", authMiddleware, FetchHouseholdIncome);
router.post("/employement-status", authMiddleware, FetchEmployementStatus);
router.post("/department", authMiddleware, FetchDepartment);
router.post("/function", authMiddleware, FetchFunction);
// Export the router
module.exports = router;
