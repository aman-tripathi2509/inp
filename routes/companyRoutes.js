const express = require("express");
const router = express.Router();
const { getCompaniesAndUsers, getCompanyDetailsById, getAllCompanies, getCompanyAverageRatings,fetchCompanyNames,globalSearchController} = require("../controllers/companyProfileController"); 
//const { signup, login } = require("../controllers/userController");  // Import both functions
const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware

// companyAndInpUserDetails Route
router.post("/data",authMiddleware, getCompaniesAndUsers);  // Use `/signup` for registration

// companyDetails Route
router.post("/company-detail-byId",authMiddleware, getCompanyDetailsById);  // Use `/signup` for registration

//All company
router.post("/all-companies",authMiddleware, getAllCompanies); 

// company feedback 
router.post("/all-feedbacks",authMiddleware, getCompanyAverageRatings);

// company names
router.post("/fetch-companyNames", fetchCompanyNames);

// Global search 
router.post("/globalSearch",authMiddleware, globalSearchController);
// Export the router
module.exports = router;
