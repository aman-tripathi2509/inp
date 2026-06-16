const otpModel = require("../models/otpModel");
require("dotenv").config();

/*--------------------------------------------------------------
    GENERATE OTP
--------------------------------------------------------------*/
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/*--------------------------------------------------------------
    SEND EMAIL OTP
--------------------------------------------------------------*/
const sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        await otpModel.saveOtp({ email, otp, expiresAt });
        const sendEmail = require("../utils/emailService");
        await sendEmail({
    to: email,
    subject: "Email Verification Code",
    content: `
            <div style="
                background:#f4f6f8;
                padding:40px 20px;
                font-family: Arial, Helvetica, sans-serif;
            ">
                <div style="
                    max-width:520px;
                    margin:auto;
                    background:#ffffff;
                    padding:35px;
                    border-radius:14px;
                    box-shadow:0 8px 20px rgba(0,0,0,0.08);
                ">

                    <h2 style="
                        text-align:center;
                        color:#1e3a5f;
                        margin-bottom:25px;
                        font-weight:600;
                    ">
                        Email Verification
                    </h2>

                    <p style="color:#2c3e50; font-size:14px;">
                        Hello,
                    </p>

                    <p style="color:#2c3e50; font-size:14px; line-height:1.6;">
                        Thank you for verifying your email address.
                        Please use the One-Time Password (OTP) below to complete your verification:
                    </p>

                    <div style="text-align:center; margin:35px 0;">
                        <span style="
                            display:inline-block;
                            background:#e8f5e9;
                            padding:14px 28px;
                            border-radius:10px;
                            font-size:32px;
                            letter-spacing:8px;
                            font-weight:bold;
                            color:#1b5e20;
                            box-shadow:0 4px 12px rgba(0,0,0,0.06);
                        ">
                            ${otp}
                        </span>
                    </div>

                    <p style="color:#2c3e50; font-size:14px;">
                        This code is valid for <strong>5 minutes</strong>.
                    </p>

                    <p style="color:#2c3e50; font-size:14px; line-height:1.6;">
                        If you did not request this verification, please ignore this email.
                        No action will be taken.
                    </p>

                    <hr style="margin:25px 0; border:none; border-top:1px solid #eee;" />

                    <p style="color:#2c3e50; font-size:13px;">
                        Regards,<br/>
                        <strong>IRB Support Team</strong>
                    </p>
                </div>

                <p style="
                    text-align:center;
                    font-size:12px;
                    color:#888;
                    margin-top:25px;
                ">
                    © ${new Date().getFullYear()} IRB. All rights reserved.
                </p>
            </div>
    `
});

        return res.status(200).json({
            message: "OTP sent to email"
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
};

/*--------------------------------------------------------------
    VERIFY EMAIL OTP
--------------------------------------------------------------*/
const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP required"
            });
        }
        const verified = await otpModel.verifyOtp({ email, otp });
        if (!verified) {
            return res.status(400).json({
                message: "Invalid or expired OTP"
            });
        }
        return res.status(200).json({
            message: "Email verified successfully"
        });
    } catch (err) {
        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    sendEmailOtp,
    verifyEmailOtp
};