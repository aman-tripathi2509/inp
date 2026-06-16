const db = require("../config/db");// getting the database connection
const nodemailer = require("nodemailer");

   


class contact{
    static async storeDetails(data) {
        try {
            const transporter = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: process.env.EMAIL, // Replace with your email
                    pass: process.env.PASS, // Replace with app password
                },
            });
            const { name, email, phone_no, contact_method, message } = data;
            
            const sql = `INSERT INTO inp_contact(name, email, phone_no, contact_method, message) VALUES (?, ?, ?, ?, ?)`;
            const values = [name, email, phone_no, contact_method, message];
        
            const [result] = await db.execute(sql, values); // Execute SQL query
            console.log(email);
          if(result){
            await transporter.sendMail({
                from: `"Support" <${process.env.EMAIL}>`,
                to: email,
                subject: "Query Successfully received",
                text: `Thank you for reaching out to us! Your message has been successfully submitted. We will get back to you soon.`,
           })
        }
            return { success: true, message: "Data stored successfully"};
        } catch (error) {
            console.error("Error storing data:", error);
            return { success: false, message: "Failed to store data", error };
        }
    }
}
module.exports=contact;