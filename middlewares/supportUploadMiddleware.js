const fs = require("fs");
const path = require("path");
const multer = require("multer");

const supportUploadDir = path.join(
    __dirname,
    "..",
    "public",
    "uploads",
    "support"
);

fs.mkdirSync(supportUploadDir, {
    recursive: true
});

const extensionsByMimeType = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, supportUploadDir);
    },
    filename: (req, file, cb) => {
        const extension = extensionsByMimeType[file.mimetype];

        cb(
            null,
            `support_${Date.now()}_${Math.round(Math.random() * 1E9)}${extension}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    if (extensionsByMimeType[file.mimetype]) {
        return cb(null, true);
    }

    return cb(
        new Error("Only JPG, JPEG, PNG and WEBP images are allowed"),
        false
    );
};

const supportUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const uploadSupportAttachment = (req, res, next) => {
    supportUpload.single("attachment")(req, res, (error) => {
        if (!error) {
            return next();
        }

        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Attachment must be 5 MB or smaller"
            : error.message;

        return res.status(400).json({
            success: false,
            message
        });
    });
};

module.exports = {
    uploadSupportAttachment
};
