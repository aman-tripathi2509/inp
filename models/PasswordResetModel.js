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
            email,
            otp_hash,
            otp_created_at,
            otp_expires_at,
            otp_attempts,
            otp_verified,
            pending_password_hash,

            CASE
                WHEN otp_created_at IS NULL THEN NULL
                ELSE TIMESTAMPDIFF(
                    SECOND,
                    otp_created_at,
                    NOW()
                )
            END AS otp_elapsed_seconds

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


// Save OTP
const savePasswordResetOTP = async (
    id,
    otpHash,
    otpExpiresAt
) => {

    const sql = `
        UPDATE user_password_reset_tokens
        SET
            otp_hash = ?,
            otp_created_at = NOW(),
            otp_expires_at = ?,
            otp_attempts = 0,
            otp_verified = 0
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [
            otpHash,
            otpExpiresAt,
            id
        ]
    );

    return result;
};


// Get valid OTP
const getValidPasswordResetOTP = async (id) => {

    const sql = `
        SELECT
            id,
            member_id,
            email,
            otp_hash,
            otp_expires_at,
            otp_attempts,
            otp_verified,
            pending_password_hash
        FROM user_password_reset_tokens
        WHERE id = ?
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
    `;

    const [rows] = await db.query(
        sql,
        [id]
    );

    return rows.length > 0 ? rows[0] : null;
};


// Save pending ENCRYPTED password
const savePendingPasswordHash = async (
    id,
    encryptedPassword
) => {

    const sql = `
        UPDATE user_password_reset_tokens
        SET pending_password_hash = ?
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [
            encryptedPassword,
            id
        ]
    );

    return result;
};


// Increment OTP attempts
const incrementOTPAttempts = async (id) => {

    const sql = `
        UPDATE user_password_reset_tokens
        SET otp_attempts = otp_attempts + 1
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [id]
    );

    return result;
};


// Mark OTP verified
const markPasswordResetOTPVerified = async (id) => {

    const sql = `
        UPDATE user_password_reset_tokens
        SET
            otp_verified = 1,
            otp_hash = NULL,
            otp_expires_at = NULL
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [id]
    );

    return result;
};

const getRecentPasswordResetRequest = async (email) => {
    try {

        const sql = `
            SELECT
                id,
                created_at,
                TIMESTAMPDIFF(
                    SECOND,
                    created_at,
                    NOW()
                ) AS elapsed_seconds
            FROM user_password_reset_tokens
            WHERE email = ?
            ORDER BY id DESC
            LIMIT 1
        `;

        const [rows] = await db.query(
            sql,
            [email]
        );

        return rows[0] || null;

    } catch (error) {
        throw error;
    }
};


module.exports = {
    createPasswordResetToken,
    getValidPasswordResetToken,
    markPasswordResetTokenUsed,
    savePasswordResetOTP,
    getValidPasswordResetOTP,
    savePendingPasswordHash,
    incrementOTPAttempts,
    markPasswordResetOTPVerified,
    getRecentPasswordResetRequest
};