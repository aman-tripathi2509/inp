const express = require("express");
const router = express.Router();
const { getCompanies, getCompanyDetailsById, createCompany, getMappedCompanyDetailsByDomain} = require("../controllers/AdminCompanyController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Get Companies
router.post("/getCompanies", authMiddleware, getCompanies);
// Get Company Details By ID
router.post("/getCompanyDetailsById", authMiddleware, getCompanyDetailsById);
// Insert company data
router.post("/create-company", authMiddleware, createCompany);
// New route for fetching raw and mapped company details by domain
router.post('/get-mapped-by-domain', authMiddleware,getMappedCompanyDetailsByDomain);

module.exports = router;
