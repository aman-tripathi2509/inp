const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer();

const {
    getSignupRequests,
    approve_membership,
    reject_request,
    setPassword
} = require("../controllers/MembershipController");

const { authMiddleware } = require("../middlewares/authMiddleware");

// Get Signup Requests
router.post(
    "/signup-requests",
    authMiddleware,
    upload.none(),
    getSignupRequests
);

// Approve Signup Request
router.post(
    "/approve-membership",
    authMiddleware,
    upload.none(),
    approve_membership
);

// Reject Signup Request
router.post(
    "/reject-membership",
    authMiddleware,
    upload.none(),
    reject_request
);

// Set Password
router.post(
    "/set-password",
    setPassword
);

module.exports = router;