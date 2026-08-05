const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer();

const {
    Adminlogin,
    AdminGetInpUsers,
    AdmingetINPUserById,
    AdminAddInpUser
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
    "/addInpUser",
    authMiddleware,
    upload.none(),
    AdminAddInpUser
);

module.exports = router;