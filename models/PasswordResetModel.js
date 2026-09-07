const db = require("../config/db");


// Create password reset token
const createPasswordResetToken = async (
    memberId,
    email,
    tokenHash,
    expiresAt
) => {

    const sql = `
        INSERT INTO user_password_reset_tokens
        (
            member_id,
            email,
            token_hash,
            expires_at
        )
        VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.query(
        sql,
        [
            memberId,
            email,
            tokenHash,
            expiresAt
        ]
    );

    return result;
};


// Get valid password reset token
const getValidPasswordResetToken = async (tokenHash) => {

    const sql = `
        SELECT
            id,
            member_id,
            email
        FROM user_password_reset_tokens
        WHERE token_hash = ?
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
    `;

    const [rows] = await db.query(
        sql,
        [tokenHash]
    );

    return rows.length > 0 ? rows[0] : null;
};


// Mark reset token as used
const markPasswordResetTokenUsed = async (id) => {

    const sql = `
        UPDATE user_password_reset_tokens
        SET used_at = NOW()
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [id]
    );

    return result;
};


module.exports = {
    createPasswordResetToken,
    getValidPasswordResetToken,
    markPasswordResetTokenUsed
};