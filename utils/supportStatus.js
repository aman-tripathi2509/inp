const SUPPORT_STATUS = Object.freeze({
    PENDING: 1,
    IN_PROGRESS: 2,
    RESOLVED: 3,
    CLOSED: 4
});

const SUPPORT_STATUS_NAMES = Object.freeze({
    [SUPPORT_STATUS.PENDING]: "pending",
    [SUPPORT_STATUS.IN_PROGRESS]: "in_progress",
    [SUPPORT_STATUS.RESOLVED]: "resolved",
    [SUPPORT_STATUS.CLOSED]: "closed"
});

const getSupportStatusName = (status) => (
    SUPPORT_STATUS_NAMES[Number(status)] || null
);

module.exports = {
    SUPPORT_STATUS,
    getSupportStatusName
};
