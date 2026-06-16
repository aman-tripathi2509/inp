const express = require("express");
const router = express.Router();

const {
    sendEmailOtp,
    verifyEmailOtp
} = require("../controllers/otpController");

/*--------------------------------------------------------------
    SEND EMAIL OTP
--------------------------------------------------------------*/
router.post("/send-email-otp", sendEmailOtp);

/*--------------------------------------------------------------
    VERIFY EMAIL OTP
--------------------------------------------------------------*/
router.post("/verify-email-otp", verifyEmailOtp);

module.exports = router;