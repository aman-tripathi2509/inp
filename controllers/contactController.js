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
    subject: "Your enquiry has been received | Industry & People",
    content: `
<!DOCTYPE html>
<html>

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Industry & People</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 15px;">

<tr>
<td align="center">

<table width="650" cellpadding="0" cellspacing="0"
style="background:#ffffff;border-radius:12px;overflow:hidden;">

<!-- Header -->

<tr>

<td
style="
background:#111111;
padding:35px;
text-align:center;
">

<h1
style="
margin:0;
font-size:34px;
color:#ffffff;
font-weight:bold;
">
Industry <span style="color:#d62839;">&</span> People
</h1>

<p
style="
margin-top:15px;
color:#ffffff;
font-size:28px;
font-weight:bold;
line-height:40px;
">

<span style="color:#d62839;">Research</span>
Fuels Innovation.

</p>

<p
style="
margin-top:8px;
color:#d5d5d5;
font-size:18px;
">


</p>

</td>

</tr>

<!-- Body -->

<tr>

<td style="padding:45px;">

<h2
style="
margin-top:0;
color:#d62839;
">
Hello ${name},
</h2>

<p
style="
font-size:17px;
line-height:30px;
color:#555;
">

Thank you for contacting
<b>Industry & People.</b>

</p>

<p
style="
font-size:17px;
line-height:30px;
color:#555;
">

We have successfully received your enquiry.

Our team is reviewing your request and will get back to you within
<strong>24 - 48 business hours.</strong>

</p>

<!-- Request Card -->

<table
width="100%"
cellpadding="12"
cellspacing="0"
style="
margin-top:35px;
background:#fafafa;
border:1px solid #eeeeee;
border-left:5px solid #d62839;
">

<tr>
<td width="180"><b>Name</b></td>
<td>${name}</td>
</tr>

<tr>
<td><b>Email</b></td>
<td>${email}</td>
</tr>

<tr>
<td><b>Phone</b></td>
<td>${phone_no}</td>
</tr>

<tr>
<td><b>Preferred Contact</b></td>
<td>${contact_method}</td>
</tr>

<tr>
<td valign="top"><b>Your Message</b></td>
<td>${message}</td>
</tr>

</table>

<!-- Status -->

<table
width="100%"
cellpadding="0"
cellspacing="0"
style="
margin-top:35px;
background:#fff8f8;
border:1px solid #ffd7dc;
">

<tr>

<td
style="
padding:20px;
">

<p
style="
margin:0;
font-size:18px;
font-weight:bold;
color:#d62839;
">

✔ Request Received Successfully

</p>

<p
style="
margin-top:12px;
font-size:15px;
line-height:26px;
color:#555;
">

Thank you for reaching out.

We appreciate your interest and look forward to connecting with you.

</p>

</td>

</tr>

</table>

<!-- Button -->

<table
width="100%"
cellpadding="0"
cellspacing="0"
style="margin-top:40px;">

<tr>

<td align="center">

<a
href="https://iptest.irbureau.com/"
style="
display:inline-block;
background:#d62839;
color:#ffffff;
text-decoration:none;
padding:16px 45px;
font-size:17px;
font-weight:bold;
border-radius:50px;
">

Visit Industry & People

</a>

</td>

</tr>

</table>

</td>

</tr>

<!-- Footer -->

<tr>

<td
style="
background:#111111;
padding:40px;
text-align:center;
">

<h2
style="
margin:0;
color:#ffffff;
">
Industry <span style="color:#d62839;">&</span> People
</h2>


<p
style="
margin-top:5px;
font-size:16px;
color:#d6d6d6;
">


</p>

<hr
style="
border:none;
border-top:1px solid #333;
margin:30px 0;
">

<p
style="
color:#777777;
font-size:13px;
margin-top:20px;
">

© ${new Date().getFullYear()} Industry & People.
All Rights Reserved.

</p>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
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