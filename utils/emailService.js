const axios = require("axios");
require("dotenv").config();

const sendEmail = async ({ to, subject, content }) => {
    try {
        console.log("=================================");
        console.log("📤 EMAIL SERVICE START");

        console.log("EMAIL_STATUS:", process.env.EMAIL_STATUS);

        // ✅ Check toggle
        if (process.env.EMAIL_STATUS !== "1") {
            console.log("❌ Email service disabled from ENV");
            return {
                status: false,
                error: "Email disabled"
            };
        }

        if (!to) {
            console.log("❌ No recipient email");
            return {
                status: false,
                error: "Missing email"
            };
        }

        const payload = {
            mailTo: String(to).trim(),
            mailFrom: process.env.MAIL_FROM,
            replyTo: process.env.MAIL_REPLY_TO,
            bodyContent: content,
            subject: subject,
            projectName: process.env.MAIL_PROJECT_NAME
        };

        console.log("📦 Payload:", payload);

        const response = await axios.post(
            process.env.MAIL_API_URL,
            payload,
            {
                headers: {
                    "accept": "application/json",
                    "X-API-Key": process.env.MAIL_API_KEY,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }
        );

        console.log("✅ MAIL API RESPONSE:", response.data);
        console.log("=================================");

        return {
            status: true,
            response: response.data
        };

    } catch (error) {
        console.log("=================================");
        console.error("❌ MAIL FAILED");

        console.error("STATUS:", error.response?.status);
        console.error("DATA:", error.response?.data);
        console.error("HEADERS:", error.response?.headers);
        console.error("MESSAGE:", error.message);

        console.log("=================================");

        return {
            status: false,
            error: error.response?.data || error.message
        };
    }
};

module.exports = sendEmail;