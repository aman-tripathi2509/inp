const express = require("express");
const router = express.Router();

const {
    createSupportRequest
} = require("../controllers/supportController");
const {
    authMiddleware
} = require("../middlewares/authMiddleware");
const {
    uploadSupportAttachment
} = require("../middlewares/supportUploadMiddleware");

router.post(
    "/create",
    authMiddleware,
    uploadSupportAttachment,
    createSupportRequest
);

module.exports = router;
