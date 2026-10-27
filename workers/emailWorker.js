const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const sendEmail = require("../utils/emailService");

const BATCH_SIZE = 10;
const POLL_INTERVAL = 2000;
const PROCESSING_TIMEOUT_MINUTES = 10;

const escapeHtml = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const renderTemplate = (templateName, payload) => {

    const templatePath = path.join(
        __dirname,
        "..",
        "email-templates",
        templateName
    );

    let content = fs.readFileSync(
        templatePath,
        "utf8"
    );

    Object.entries(payload).forEach(
        ([key, value]) => {

            const escapedValue =
                escapeHtml(value);

            content = content.replace(
                new RegExp(
                    `{{${key}}}`,
                    "g"
                ),
                escapedValue
            );
        }
    );

    return content;
};

const recoverStuckEmails = async () => {

    await db.query(
        `
        UPDATE inp_email_queue
        SET
            status = 'pending',
            locked_at = NULL
        WHERE
            status = 'processing'
            AND locked_at < DATE_SUB(
                NOW(),
                INTERVAL ? MINUTE
            )
        `,
        [PROCESSING_TIMEOUT_MINUTES]
    );
};

const processEmailQueue = async () => {

    let connection;

    try {

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [jobs] = await connection.query(
            `
            SELECT *
            FROM inp_email_queue
            WHERE
                (
                    status = 'pending'
                    AND available_at <= NOW()
                )
                OR
                (
                    status = 'failed'
                    AND attempts < max_attempts
                    AND available_at <= NOW()
                )
            ORDER BY
                priority ASC,
                available_at ASC,
                id ASC
            LIMIT ?
            FOR UPDATE
            `,
            [BATCH_SIZE]
        );

        if (!jobs.length) {

            await connection.commit();

            return;
        }

        const jobIds = jobs.map(
            job => job.id
        );

        await connection.query(
            `
            UPDATE inp_email_queue
            SET
                status = 'processing',
                locked_at = NOW(),
                attempts = attempts + 1
            WHERE id IN (?)
            `,
            [jobIds]
        );

        await connection.commit();

        for (const job of jobs) {

            await sendQueuedEmail(job);
        }

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(
            "Email worker error:",
            error
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

const sendQueuedEmail = async (job) => {

    try {

        const payload =
            typeof job.payload === "string"
                ? JSON.parse(job.payload)
                : job.payload;

        const emailContent =
            renderTemplate(
                job.template_name,
                payload
            );

        await sendEmail({
            to: job.recipient_email,
            subject: job.subject,
            content: emailContent
        });

        await db.query(
            `
            UPDATE inp_email_queue
            SET
                status = 'sent',
                sent_at = NOW(),
                locked_at = NULL
            WHERE id = ?
            `,
            [job.id]
        );

        console.log(
            `[EMAIL SENT] #${job.id} ${job.email_type} → ${job.recipient_email}`
        );

    } catch (error) {

        console.error(
            `[EMAIL FAILED] #${job.id}`,
            error.message
        );

        const retryDelayMinutes =
            Math.min(
                Math.pow(2, job.attempts),
                60
            );

        const newStatus =
            job.attempts >= job.max_attempts
                ? "failed"
                : "failed";

        await db.query(
            `
            UPDATE inp_email_queue
            SET
                status = ?,
                locked_at = NULL,
                available_at = DATE_ADD(
                    NOW(),
                    INTERVAL ? MINUTE
                ),
                last_error = ?
            WHERE id = ?
            `,
            [
                newStatus,
                retryDelayMinutes,
                String(error.message || error),
                job.id
            ]
        );
    }
};

const startWorker = async () => {

    console.log(
        "===================================="
    );

    console.log(
        "INP Email Worker Started"
    );

    console.log(
        `Batch Size: ${BATCH_SIZE}`
    );

    console.log(
        `Poll Interval: ${POLL_INTERVAL}ms`
    );

    console.log(
        "===================================="
    );

    await recoverStuckEmails();

    setInterval(
        async () => {

            try {

                await recoverStuckEmails();

                await processEmailQueue();

            } catch (error) {

                console.error(
                    "Worker cycle error:",
                    error
                );
            }

        },
        POLL_INTERVAL
    );
};

startWorker();