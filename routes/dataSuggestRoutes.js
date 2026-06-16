const express = require("express");
const router = express.Router();
//const referController =require("../controllers/referController");
const dataController= require('../controllers/dataSuggestController');
const { authMiddleware } = require("../middlewares/authMiddleware"); 

router.post('/company_name',authMiddleware,dataController.getCompanyName);
router.post('/employee',authMiddleware,dataController.getEmployees);
router.post('/revenue', authMiddleware,dataController.getRevenue);
router.post('/sectorIndustries', authMiddleware,dataController.getSectorIndustries);
router.post('/workStatus', authMiddleware,dataController.workController);
router.post('/employementStatus', authMiddleware,dataController.employementController);
router.post('/questionAnswers', authMiddleware,dataController.getquesAns);


module.exports=router;

