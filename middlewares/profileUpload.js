const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(
    __dirname,
    "../public/uploads/profile_photos"
);

// Create folder if it doesn't exist
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },

    filename: function (req, file, cb) {

        const extension = path.extname(file.originalname).toLowerCase();

        const fileName =
            "profile_" +
            Date.now() +
            "_" +
            Math.round(Math.random() * 1000000000) +
            extension;

        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed"
            ),
            false
        );
    }
};

const profileUpload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: fileFilter
});

module.exports = profileUpload;