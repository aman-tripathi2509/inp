const express = require("express");
const router = express.Router();
const {getCompanyDetailsById, getAllCompanies, getCompanyAverageRatings,fetchCompanyNames,globalSearchController} = require("../controllers/companyProfileController"); 
//const { signup, login } = require("../controllers/userController");  // Import both functions
const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware

// companyDetails Route
router.post("/company-detail-byId",authMiddleware, getCompanyDetailsById);  // Use `/signup` for registration

//All company
router.post("/all-companies",authMiddleware, getAllCompanies);

// company feedback 
router.post("/all-feedbacks",authMiddleware, getCompanyAverageRatings);

// company feedback 
router.post("/fetch-companyNames",authMiddleware, fetchCompanyNames);

// company feedback 
router.post("/globalSearch",authMiddleware, globalSearchController);

// Export the router
module.exports = router;
