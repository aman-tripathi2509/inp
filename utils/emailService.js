// const nodemailer = require("nodemailer");
// require("dotenv").config();

// const transporter = nodemailer.createTransport({
//     host: "smtp-relay.sendinblue.com",
//     port: 587,
//     secure: false,
//     auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS
//     },
//     tls: {
//         rejectUnauthorized: false
//     }
// });

// const sendEmail = async (to, subject, html) => {
//     return transporter.sendMail({
//         from: '"CSMT" <aman.tripathi@logzerotechnologies.com>',
//         to,
//         subject,
//         html
//     });
// };

// module.exports = sendEmail;

const axios = require("axios");
require("dotenv").config();

/*--------------------------------------------------------------
    SEND EMAIL (BREVO API - SAME AS PHP)
--------------------------------------------------------------*/
const sendEmail = async ({
    to,
    subject,
    content,
    cc = [],
    bcc = [],
    attachments = [],
    type = "html"
}) => {
    try {

        // ✅ Check config
        if (process.env.EMAIL_STATUS !== "1") {
            return {
                status: false,
                error: "Email service is disabled"
            };
        }

        const data = {
            sender: {
                name: process.env.APP_NAME,
                email: process.env.SMTP_USER
            },
            to: [
                {
                    email: String(to).trim()
                }
            ],
            subject: subject,
            htmlContent: content
        };

        // ✅ Content type
        if (type === "html") {
            data.htmlContent = content;
        } else {
            data.textContent = content.replace(/<[^>]*>/g, '');
        }

        // ✅ CC
        if (cc.length > 0) {
            data.cc = cc.map(email => ({ email }));
        }

        // ✅ BCC
        if (bcc.length > 0) {
            data.bcc = bcc.map(email => ({ email }));
        }

        // ✅ Attachments
        if (attachments.length > 0) {
            const fs = require("fs");
            data.attachment = [];

            for (let filePath of attachments) {
                if (fs.existsSync(filePath)) {
                    data.attachment.push({
                        name: require("path").basename(filePath),
                        content: fs.readFileSync(filePath).toString("base64")
                    });
                }
            }
        }

        // ✅ API Call
        const response = await axios.post(
            process.env.BREVO_MAIL_API_URL,
            data,
            {
                headers: {
                    "accept": "application/json",
                    "api-key": process.env.BREVO_MAIL_API_KEY,
                    "content-type": "application/json"
                }
            }
        );

        console.log("✅ Mail sent via API");

        return {
            status: true,
            response: response.data
        };

    } catch (error) {
        console.error("❌ API MAIL ERROR:", error.response?.data || error.message);

        return {
            status: false,
            error: error.response?.data || error.message
        };
    }
};

module.exports = sendEmail;