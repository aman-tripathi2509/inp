const contact = require("../models/contactModel");

const contactController = async (req, res) => {
    try {
        //const {name,email,phone_no,contact_method,message} = req.body;//for sectors questions
        const { name, email, phone_no, contact_method, message } = req.body;

        if (!name || !email || !phone_no || !contact_method || !message) {
            return res.status(400).json({ error: "All fields are required." });
        }
        //console.log(req.body);
        // Regular expressions for validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // Simple email format check
            const phoneRegex = /^\d{10,12}$/; // Checks for a 10-digit phone number

            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: "Invalid email format" });
            }

            if (!phoneRegex.test(phone_no)) {
                return res.status(400).json({ error: "Invalid phone number format." });
            }
         const allSectors = await contact.storeDetails(req.body);
        // Return the fetched sectors instead of the error message
        res.status(200).json({ message: "Thank you for reaching out to us! Your message has been successfully submitted. We will get back to you soon." });
    }
    catch (error) {
        console.error('Error', error);
        res.status(500).json({ message: "oops! something went wrong." });
    }
}

module.exports = contactController;