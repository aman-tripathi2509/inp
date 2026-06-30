const express = require("express");
const router = express.Router();
const multer = require("multer");
const { globalSearchController } = require("../controllers/globalController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const formDataParser = multer().none();

router.post("/globalSearch", authMiddleware, formDataParser, globalSearchController);

module.exports = router;