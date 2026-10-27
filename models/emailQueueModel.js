const db = require("../config/db");

const addEmailToQueue = async ({
    emailType,
    surveyId = null,
    memberId = null,
    recipientEmail,
    subject,
    templateName,
    payload,
    priority = 5,
    maxAttempts = 5,
    idempotencyKey
}) => {

    const [result] = await db.query(
        `
        INSERT INTO inp_email_queue
        (
            email_type,
            survey_id,
            member_id,
            recipient_email,
            subject,
            template_name,
            payload,
            status,
            priority,
            attempts,
            max_attempts,
            available_at,
            idempotency_key
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?,
            'pending',
            ?,
            0,
            ?,
            DATE_ADD(NOW(), INTERVAL 1 MINUTE),
            ?
        )
        ON DUPLICATE KEY UPDATE
            id = id
        `,
        [
            emailType,
            surveyId,
            memberId,
            recipientEmail,
            subject,
            templateName,
            JSON.stringify(payload),
            priority,
            maxAttempts,
            idempotencyKey
        ]
    );

    return {
        id: result.insertId || null
    };
};

module.exports = {
    addEmailToQueue
};