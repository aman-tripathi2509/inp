const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
//const referModel = require("../models/referModel");
const {getUserById}=require("../models/userModel")


const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL, // Replace with your email
        pass: process.env.PASS, // Replace with app password
    },
});

const referController = async (req, res) => {

    try {
        //const decoded = jwt.verify(token,  process.env.JWT_SECRET);
       // const userId = decoded.userId;
       const userToken= req.user;
       //console.log("user",req.user);
       // console.log("user",userToken.userId);
        // Assuming you have a User model or database call
        const user = await getUserById(userToken.userId); // replace with actual DB logic
       
        const member_id=user[0].member_id;
       const referralEmail=req.body.email;
       
       const refToken= generateReferralToken(member_id);
       //const referralLink = `http://local.com/signup?ref=${encodeURIComponent(refToken)}`;
       const referralLink = `${process.env.BASE_URL}/signup?ref=${encodeURIComponent(refToken)}`;
        console.log( "referral link:- ", referralLink);
       // await sendReferralEmail(referralEmail, referralLink);
       //for email:-
       await transporter.sendMail({
        from: `"Support" <${process.env.EMAIL}>`,
        to: referralEmail,
        subject: "Referral email Request",
        text: `Click the link to signIn:  ${referralLink}`,
        // html: `
        //     <p>Hello 👋,</p>
        //     <p>You’ve been invited to join our platform! Use the button below to sign up:</p>
        //     <a href="${referralLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Join Now</a>
        //     <p>Or click this link: <a href="${referralLink}">${referralLink}</a></p>
        // `
    });
        res.status(200).json({ message: "Referral email sent!", referralLink });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    //     return res.json({ member_id, referralEmail,refLink});
    // } catch (err) {
    //     return res.status(401).json({ error: err.message});
    // }

}


function generateReferralToken(member_id) {
   // const secretKey = process.env.REFERRAL_SECRET_KEY || "yourSecretKey";
    const token = jwt.sign({ member_id }, process.env.JWT_SECRET); 
    return token;
}

function decodeReferralToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.member_id;
    } catch (err) {
        return null;
    }
}
// function generateReferralLink(member_id) {
//     const token = generateReferralToken(member_id);
//     return `http://local.com/signup?ref=${encodeURIComponent(token)}`;
// }
module.exports=referController;