const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer();

const {
    Adminlogin,
    AdminGetInpUsers,
    AdmingetINPUserById,
    AdminAddInpUser,
    AdminUpdateInpUser
} = require("../controllers/AdminuserController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminLoginLimiter } = require("../middlewares/loginRateLimiter");

// Admin Login Route
router.post("/Adminlogin", upload.none(), adminLoginLimiter, Adminlogin);

// Fetch Users
router.post(
    "/getInpUsers",
    authMiddleware,
    upload.none(),
    AdminGetInpUsers
);

// Fetch Single User
router.post(
    "/getINPUserById",
    authMiddleware,
    upload.none(),
    AdmingetINPUserById
);

// Add User
router.post(
    "/add-user",
    authMiddleware,
    upload.none(),
    AdminAddInpUser
);

// Update User
router.post(
    "/update-user",
    authMiddleware,
    upload.none(),
    AdminUpdateInpUser
);

module.exports = router;
