const express = require("express");
const router = express.Router();

const { Adminlogin, AdminGetInpUsers, AdmingetINPUserById, AdminAddInpUser } = require("../controllers/AdminuserController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Admin Login Route
router.post("/Adminlogin", Adminlogin);

// Fetch Users (with filters) - Changed to POST
router.post("/getInpUsers", authMiddleware, AdminGetInpUsers);

// Fetch Single User by member_id
router.post("/getINPUserById", authMiddleware, AdmingetINPUserById);

// Add User
router.post("/addInpUser", authMiddleware, AdminAddInpUser);

module.exports = router;