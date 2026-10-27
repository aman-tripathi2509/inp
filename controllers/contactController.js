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
        
        // Validate name - alphabets and spaces only, max 55 characters
        const trimmedName = name.trim();
        const nameRegex = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
        
        if (
            trimmedName.length < 2 ||
            trimmedName.length > 55 ||
            !nameRegex.test(trimmedName)
        ) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 55 characters and contain alphabets and spaces only."
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
        
        // Validate contact number - exactly 10 digits
        const phoneRegex = /^[0-9]{10}$/;
        
        if (!phoneRegex.test(phone_no)) {
            return res.status(400).json({
                success: false,
                message: "Contact number must contain exactly 10 digits."
            });
        }
        
        // Validate message - max 500 characters
        const trimmedMessage = message.trim();
        
        if (trimmedMessage.length < 1 || trimmedMessage.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Message must not exceed 500 characters."
            });
        }

        // Save contact details
        // await Contact.storeDetails(req.body);
        await Contact.storeDetails({
            ...req.body,
            name: trimmedName,
            message: trimmedMessage
        });

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