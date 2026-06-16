const express = require("express");
const router = express.Router();
//const referController =require("../controllers/referController");
const employeeFeedbackController= require('../controllers/employeeFeedbackController');
const { authMiddleware } = require("../middlewares/authMiddleware"); 

router.post('/saveFeedback',authMiddleware,employeeFeedbackController.saveFeedback);
router.post('/employeeFeedbackData',authMiddleware, employeeFeedbackController.fetchFeedbackData);
router.post('/fetch-employees',authMiddleware, employeeFeedbackController.fetchEmployees);

module.exports=router;