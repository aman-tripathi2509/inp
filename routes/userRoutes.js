const express = require("express");
const router = express.Router();
const { signup, login, membership_Request,update_UserData,user_detail, getCompanyEmployees,fetchUsers,HighestEducation,getStates,WorkStatus,PrimaryProfession,TotalWorkEx,SeniorityLevel,WorkExCurrentCompany,BusinessModel,CompanyRevenue,CompanyType,FetchYears,FetchHouseholdIncome,FetchEmployementStatus,FetchDepartment,FetchFunction} = require("../controllers/userController");  // Import both functions
const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware

// Signup Route
router.post("/signup", signup);

// Login Route
router.post("/login", login);    // Use `/login` for authentication
router.post("/membership-request" ,membership_Request);
router.post('/update-user',authMiddleware,update_UserData);
router.post('/user-detail',authMiddleware,user_detail);
router.post('/company-employees',authMiddleware,getCompanyEmployees);
router.post('/fetch-users',authMiddleware,fetchUsers);
router.post('/highest-education',authMiddleware,HighestEducation);
router.post('/get-states',authMiddleware,getStates);
router.post("/work-status", authMiddleware, WorkStatus);
router.post("/primary-profession", authMiddleware, PrimaryProfession);
router.post("/total-work-ex", authMiddleware, TotalWorkEx);
router.post("/seniority-level", authMiddleware, SeniorityLevel);
router.post("/Work-Ex-Current-Company", authMiddleware, WorkExCurrentCompany);
router.post("/business-model", authMiddleware, BusinessModel);
router.post("/company-revenue", authMiddleware, CompanyRevenue);
router.post("/company-type", authMiddleware, CompanyType);
router.post("/years", authMiddleware, FetchYears);
router.post("/household-income", authMiddleware, FetchHouseholdIncome);
router.post("/employement-status", authMiddleware, FetchEmployementStatus);
router.post("/department", authMiddleware, FetchDepartment);
router.post("/function", authMiddleware, FetchFunction);
// Export the router
module.exports = router;
