const express = require("express");
const router = express.Router();
//const { companyDetails } = require("../controllers/companyProfileController"); 
const autoSuggestController =require("../controllers/autoSuggestController")
const { authMiddleware } = require("../middlewares/authMiddleware");
router.post('/',authMiddleware,autoSuggestController);
// Export the router
module.exports = router; 