const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer();

const {
    getCompanies,
    getCompanyDetailsById,
    createCompany,
    getMappedCompanyDetailsByDomain
} = require("../controllers/AdminCompanyController");

const { authMiddleware } = require("../middlewares/authMiddleware");

// ====================== GET COMPANIES ======================
router.post(
    "/getCompanies",
    authMiddleware,
    upload.none(),
    getCompanies
);

// ====================== GET COMPANY DETAILS BY ID ======================
router.post(
    "/get-company-detail",
    authMiddleware,
    upload.none(),
    getCompanyDetailsById
);

// ====================== CREATE COMPANY ======================
router.post(
    "/add-company",
    authMiddleware,
    upload.none(),
    createCompany
);

// ====================== GET COMPANY DETAILS BY DOMAIN ======================
router.post(
    "/get-mapped-by-domain",
    authMiddleware,
    upload.none(),
    getMappedCompanyDetailsByDomain
);

module.exports = router;