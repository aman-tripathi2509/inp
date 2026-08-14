const db = require("../config/db");

/*--------------------------------------------------------------
    Create Login Session
--------------------------------------------------------------*/
const createLoginSession = async ({
    u_id,
    member_id,
    session_token,
    ip_address,
    user_agent,
    device,
    browser,
    operating_system,
    expires_at
}) => {
    try {

        const [result] = await db.query(
            `INSERT INTO inp_user_sessions
            (
                u_id,
                member_id,
                session_token,
                ip_address,
                user_agent,
                device,
                browser,
                operating_system,
                created_at,
                last_activity_at,
                expires_at,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 1)`,
            [
                u_id,
                member_id,
                session_token,
                ip_address,
                user_agent,
                device,
                browser,
                operating_system,
                expires_at
            ]
        );

        return {
            success: true,
            id: result.insertId
        };

    } catch (error) {
        throw error;
    }
};


const updateSessionToken = async (session_id, session_token) => {
    try {

        const [result] = await db.query(
            `UPDATE inp_user_sessions
             SET session_token = ?
             WHERE id = ?`,
            [session_token, session_id]
        );

        return result;

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Get Active Sessions
--------------------------------------------------------------*/
const getActiveSessions = async (u_id) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id,
                u_id,
                member_id,
                ip_address,
                user_agent,
                device,
                browser,
                operating_system,
                created_at,
                last_activity_at,
                expires_at,
                is_active
             FROM inp_user_sessions
             WHERE u_id = ?
               AND is_active = 1
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
             ORDER BY last_activity_at DESC`,
            [u_id]
        );

        return rows;

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Get Current Session
--------------------------------------------------------------*/
const getSessionByToken = async (u_id, session_token) => {
    try {

        const [rows] = await db.query(
            `SELECT id
             FROM inp_user_sessions
             WHERE u_id = ?
               AND session_token = ?
               AND is_active = 1
             LIMIT 1`,
            [u_id, session_token]
        );

        return rows[0] || null;

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Logout / Deactivate Single Session
--------------------------------------------------------------*/
const deactivateSession = async (u_id, session_id) => {
    try {

        const [result] = await db.query(
            `UPDATE inp_user_sessions
             SET is_active = 0,
                 last_activity_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND u_id = ?
               AND is_active = 1`,
            [session_id, u_id]
        );

        return result;

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Logout All Other Devices
--------------------------------------------------------------*/
const deactivateAllOtherSessions = async (u_id, current_session_id) => {
    try {

        const [result] = await db.query(
            `UPDATE inp_user_sessions
             SET is_active = 0,
                 last_activity_at = CURRENT_TIMESTAMP
             WHERE u_id = ?
               AND id != ?
               AND is_active = 1`,
            [u_id, current_session_id]
        );

        return result;

    } catch (error) {
        throw error;
    }
};


module.exports = {
    createLoginSession,
    updateSessionToken,
    getActiveSessions,
    getSessionByToken,
    deactivateSession,
    deactivateAllOtherSessions
};