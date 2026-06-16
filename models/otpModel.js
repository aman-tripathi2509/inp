const db = require("../config/db");

/*--------------------------------------------------------------
    SAVE EMAIL OTP
--------------------------------------------------------------*/
const saveOtp = async ({ email, otp, expiresAt }) => {
    const sql = `
        INSERT INTO otp_verifications (email, otp, expires_at)
        VALUES (?, ?, ?)
    `;
    await db.query(sql, [email, otp, expiresAt]);
};

/*--------------------------------------------------------------
    VERIFY EMAIL OTP
--------------------------------------------------------------*/
const verifyOtp = async ({ email, otp }) => {
    const sql = `
        SELECT *
        FROM otp_verifications
        WHERE email = ?
        AND otp = ?
        AND is_verified = 0
        AND expires_at > NOW()
        ORDER BY id DESC
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [email, otp]);
    if (!rows.length) {
        return null;
    }
    // Mark OTP as verified
    await db.query(
        `UPDATE otp_verifications
         SET is_verified = 1
         WHERE id = ?`,
        [rows[0].id]
    );
    return rows[0];
};

module.exports = {
    saveOtp,
    verifyOtp
};