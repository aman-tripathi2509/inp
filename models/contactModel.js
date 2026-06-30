const db = require("../config/db");

class Contact {

    static async storeDetails(data) {

        const {
            name,
            email,
            phone_no,
            contact_method,
            message
        } = data;

        const [result] = await db.execute(
            `
            INSERT INTO inp_contact
            (
                name,
                email,
                phone_no,
                contact_method,
                message
            )
            VALUES
            (?, ?, ?, ?, ?)
            `,
            [
                name,
                email,
                phone_no,
                contact_method,
                message
            ]
        );

        return result;
    }

}

module.exports = Contact;