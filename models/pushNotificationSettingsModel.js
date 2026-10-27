const db = require("../config/db");

const getSettings = async (memberId) => {
    try {
        const [rows] = await db.query(
            `
            SELECT
                id,
                member_id,
                all_notifications,
                new_survey_available,
                survey_reminders,
                reward_received,
                wallet_updates,
                referral_notifications,
                created_at,
                updated_at
            FROM user_push_notification_settings
            WHERE member_id = ?
            LIMIT 1
            `,
            [memberId]
        );

        return rows;
    } catch (error) {
        console.error("getSettings error:", error);
        throw error;
    }
};


const createDefaultSettings = async (memberId) => {
    try {
        const [result] = await db.query(
            `
            INSERT INTO user_push_notification_settings
            (
                member_id,
                all_notifications,
                new_survey_available,
                survey_reminders,
                reward_received,
                wallet_updates,
                referral_notifications
            )
            VALUES (?, 0, 0, 0, 0, 0, 0)
            `,
            [memberId]
        );

        return result;
    } catch (error) {
        console.error(
            "createDefaultSettings error:",
            error
        );
        throw error;
    }
};


const updateSettings = async (
    memberId,
    settings
) => {
    try {
        const [result] = await db.query(
            `
            UPDATE user_push_notification_settings
            SET
                all_notifications = ?,
                new_survey_available = ?,
                survey_reminders = ?,
                reward_received = ?,
                wallet_updates = ?,
                referral_notifications = ?,
                updated_at = NOW()
            WHERE member_id = ?
            `,
            [
                settings.all_notifications,
                settings.new_survey_available,
                settings.survey_reminders,
                settings.reward_received,
                settings.wallet_updates,
                settings.referral_notifications,
                memberId
            ]
        );

        return result;
    } catch (error) {
        console.error(
            "updateSettings error:",
            error
        );
        throw error;
    }
};


module.exports = {
    getSettings,
    createDefaultSettings,
    updateSettings
};