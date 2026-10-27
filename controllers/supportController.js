const fs = require("fs");
const Support = require("../models/supportModel");
const { getSupportStatusName } = require("../utils/supportStatus");

const MAX_MESSAGE_LENGTH = 5000;

const formatSupportCreatedAt = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );

    return `${values.day} ${values.month} ${values.year}, ` +
        `${values.hour}:${values.minute} ${values.dayPeriod.toUpperCase()} IST`;
};

const removeUploadedAttachment = (file) => {
    if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }
};

const createSupportRequest = async (req, res) => {
    try {
        const member_id = req.user?.member_id;
        const message = typeof req.body.message === "string"
            ? req.body.message.trim()
            : "";

        if (!member_id) {
            removeUploadedAttachment(req.file);

            return res.status(401).json({
                success: false,
                message: "Member ID not found in token"
            });
        }

        if (!message) {
            removeUploadedAttachment(req.file);

            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            removeUploadedAttachment(req.file);

            return res.status(400).json({
                success: false,
                message: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`
            });
        }

        const attachment = req.file
            ? `/uploads/support/${req.file.filename}`
            : null;

        const supportRequest = await Support.createSupportRequest({
            member_id,
            message,
            attachment
        });

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        return res.status(201).json({
            success: true,
            message: "Support request submitted successfully",
            data: {
                support_request_id: supportRequest.id,
                status: getSupportStatusName(supportRequest.status),
                message: supportRequest.message,
                attachment: supportRequest.attachment
                    ? {
                        path: supportRequest.attachment,
                        url: `${baseUrl}${supportRequest.attachment}`
                    }
                    : null,
                created_at: formatSupportCreatedAt(
                    supportRequest.created_at
                )
            }
        });
    } catch (error) {
        console.error("Error creating support request:", error);
        removeUploadedAttachment(req.file);

        return res.status(500).json({
            success: false,
            message: "Failed to submit support request"
        });
    }
};

module.exports = {
    createSupportRequest
};
