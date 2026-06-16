const express = require("express");
const router = express.Router();
const { getSignupRequests, ApproveRequest,RejectRequest} = require("../controllers/SignupRequestController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Get Signup Requests
router.post("/signup-requests", authMiddleware, getSignupRequests);
// Approve Signup Request
router.post("/approve-request", authMiddleware, ApproveRequest);
// Reject Signup Request
router.post("/reject-request", authMiddleware, RejectRequest);

module.exports = router;
