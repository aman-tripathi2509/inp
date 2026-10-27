const db = require("../config/db");
const { SUPPORT_STATUS } = require("../utils/supportStatus");

const createSupportRequest = async ({
    member_id,
    message,
    attachment
}) => {
    const [result] = await db.execute(
        `
        INSERT INTO inp_support
        (
            member_id,
            message,
            attachment,
            status
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            member_id,
            message,
            attachment,
            SUPPORT_STATUS.PENDING
        ]
    );

    const [rows] = await db.execute(
        `
        SELECT
            id,
            status,
            message,
            attachment,
            created_at
        FROM inp_support
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
    );

    return rows[0];
};

module.exports = {
    createSupportRequest
};
