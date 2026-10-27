const express = require("express");

const router = express.Router();

const {
    getNotificationSettings,
    updateNotificationSettings
} = require("../controllers/notificationController");

const {
    authMiddleware
} = require("../middlewares/authMiddleware");


router.get(
    "/settings",
    authMiddleware,
    getNotificationSettings
);


router.put(
    "/settings",
    authMiddleware,
    updateNotificationSettings
);


module.exports = router;