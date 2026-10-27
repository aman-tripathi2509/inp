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

// Admin Login Route
router.post("/Adminlogin", upload.none(), Adminlogin);

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