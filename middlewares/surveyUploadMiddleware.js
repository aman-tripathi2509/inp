const fs = require("fs");
const path = require("path");
const multer = require("multer");

const surveyUploadDir = path.join(
    __dirname,
    "..",
    "public",
    "uploads",
    "surveys"
);

fs.mkdirSync(surveyUploadDir, {
    recursive: true
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, surveyUploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();

        cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1E9)}-${baseName || "survey-image"}${ext}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files are allowed"));
    }

    return cb(null, true);
};

const surveyUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const uploadSurveyImages = (req, res, next) => {
    surveyUpload.any()(req, res, (error) => {
        if (!error) {
            return next();
        }

        return res.status(400).json({
            success: false,
            message: error.message
        });
    });
};

module.exports = {
    uploadSurveyImages
};
