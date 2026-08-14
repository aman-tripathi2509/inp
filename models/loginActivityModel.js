const db = require("../config/db");

/*--------------------------------------------------------------
    Create Login Activity
--------------------------------------------------------------*/
const createLoginActivity = async ({
    u_id = null,
    member_id = null,
    ip_address = null,
    city = null,
    country = null,
    user_agent = null,
    device = null,
    browser = null,
    operating_system = null,
    login_type,
    login_status
}) => {
    try {

        const [result] = await db.query(
            `INSERT INTO inp_login_activity
            (
                u_id,
                member_id,
                ip_address,
                city,
                country,
                user_agent,
                device,
                browser,
                operating_system,
                login_type,
                login_status,
                login_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                u_id,
                member_id,
                ip_address,
                city,
                country,
                user_agent,
                device,
                browser,
                operating_system,
                login_type,
                login_status
            ]
        );

        return {
            success: true,
            id: result.insertId
        };

    } catch (error) {

        console.error(
            "Error creating login activity:",
            error
        );

        throw error;
    }
};

module.exports = {
    createLoginActivity
};