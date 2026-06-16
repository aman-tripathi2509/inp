const express = require("express");
const router = express.Router();
//const { companyDetails } = require("../controllers/companyProfileController"); 
const contactController =require("../controllers/contactController")
router.post('/',contactController);
// Export the router
module.exports = router; 