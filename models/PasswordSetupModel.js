const db = require("../config/db");


// =====================================================
// CREATE PASSWORD SETUP TOKEN
// =====================================================

const createPasswordSetupToken = async (
    memberId,
    email,
    tokenHash,
    expiresAt
) => {

    const sql = `
        INSERT INTO user_password_setup_tokens
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


// =====================================================
// GET VALID PASSWORD SETUP TOKEN
// =====================================================

const getValidPasswordSetupToken = async (tokenHash) => {

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
        FROM user_password_setup_tokens
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


// =====================================================
// MARK TOKEN USED
// =====================================================

const markTokenUsed = async (id) => {

    const sql = `
        UPDATE user_password_setup_tokens
        SET
            used_at = NOW(),
            pending_password_hash = NULL
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [id]
    );

    return result;
};


// =====================================================
// SAVE PASSWORD SETUP OTP
// =====================================================

const savePasswordSetupOTP = async (
    id,
    otpHash,
    otpExpiresAt
) => {

    const sql = `
        UPDATE user_password_setup_tokens
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


// =====================================================
// GET VALID PASSWORD SETUP OTP
// =====================================================

const getValidPasswordSetupOTP = async (id) => {

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
        FROM user_password_setup_tokens
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


// =====================================================
// SAVE PENDING PASSWORD
// =====================================================

const savePendingPasswordHash = async (
    id,
    encryptedPassword
) => {

    const sql = `
        UPDATE user_password_setup_tokens
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


// =====================================================
// INCREMENT OTP ATTEMPTS
// =====================================================

const incrementOTPAttempts = async (id) => {

    const sql = `
        UPDATE user_password_setup_tokens
        SET otp_attempts = otp_attempts + 1
        WHERE id = ?
    `;

    const [result] = await db.query(
        sql,
        [id]
    );

    return result;
};


// =====================================================
// MARK OTP VERIFIED
// =====================================================

const markPasswordSetupOTPVerified = async (id) => {

    const sql = `
        UPDATE user_password_setup_tokens
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


module.exports = {
    createPasswordSetupToken,
    getValidPasswordSetupToken,
    markTokenUsed,

    savePasswordSetupOTP,
    getValidPasswordSetupOTP,
    savePendingPasswordHash,
    incrementOTPAttempts,
    markPasswordSetupOTPVerified
};