const db = require("../config/db");


const saveSubscription = async (
    memberId,
    endpoint,
    p256dh,
    auth,
    userAgent = null
) => {

    try {

        const [existing] = await db.query(
            `
            SELECT id
            FROM user_push_notifications
            WHERE endpoint = ?
            LIMIT 1
            `,
            [endpoint]
        );


        if (existing.length > 0) {

            const [result] = await db.query(
                `
                UPDATE user_push_notifications
                SET
                    member_id = ?,
                    p256dh = ?,
                    auth = ?,
                    user_agent = ?,
                    updated_at = NOW()
                WHERE endpoint = ?
                `,
                [
                    memberId,
                    p256dh,
                    auth,
                    userAgent,
                    endpoint
                ]
            );

            return result;
        }


        const [result] = await db.query(
            `
            INSERT INTO user_push_notifications
            (
                member_id,
                endpoint,
                p256dh,
                auth,
                user_agent
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                memberId,
                endpoint,
                p256dh,
                auth,
                userAgent
            ]
        );

        return result;

    } catch (error) {

        console.error(
            "saveSubscription error:",
            error
        );

        throw error;
    }
};


const deleteSubscription = async (
    memberId,
    endpoint
) => {

    try {

        const [result] = await db.query(
            `
            DELETE FROM user_push_notifications
            WHERE member_id = ?
            AND endpoint = ?
            `,
            [
                memberId,
                endpoint
            ]
        );

        return result;

    } catch (error) {

        console.error(
            "deleteSubscription error:",
            error
        );

        throw error;
    }
};


module.exports = {
    saveSubscription,
    deleteSubscription
};