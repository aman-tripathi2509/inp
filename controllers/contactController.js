const Contact = require("../models/contactModel");
const sendEmail = require("../utils/emailService");

const contactController = async (req, res) => {
    try {
        const {
            name,
            email,
            phone_no,
            contact_method,
            message
        } = req.body;

        // Validate required fields
        if (
            !name ||
            !email ||
            !phone_no ||
            !contact_method ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address."
            });
        }

        // Validate phone number
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(phone_no)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number."
            });
        }

        // Save contact details
        await Contact.storeDetails(req.body);

        // Send confirmation email
        const mailResult = await sendEmail({
            to: email,
            subject: "Thank You for Contacting Industry & People",
            content: `
                <p>Dear <b>${name}</b>,</p>

                <p>
                    Thank you for contacting
                    <b>Industry & People</b>.
                </p>

                <p>
                    We have received your message successfully.
                    Our team will contact you shortly.
                </p>

                <br>

                <p>Regards,</p>

                <p><b>Industry & People Team</b></p>
            `
        });

        console.log("=================================");
        console.log("📧 Mail Result:", mailResult);
        console.log("=================================");

        // Return success even if email fails
        return res.status(200).json({
            success: true,
            message: "Thank you for reaching out to us! Your message has been successfully submitted.",
            emailStatus: mailResult.status,
            emailResponse: mailResult
        });

    } catch (error) {
        console.error("CONTACT API ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Oops! Something went wrong.",
            error: error.message
        });
    }
};

module.exports = {
    contactController
};