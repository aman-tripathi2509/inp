const express = require("express");
const router = express.Router();

const {
    saveSurveyDetails,
    updateSurveyDetails,
    saveSurveyQuestions,
    previewSurvey,
    publishSurvey,
    closeSurvey,
    archiveSurvey,
    getMySurveys,
    getAvailableSurveys,
    getSurveyForMeDetails,
    submitSurvey,
    get_Countries,
    get_CompanySize,
    get_CompanyRevenue,
    getSectorIndustryHierarchy,
    getSectors,
    getIndustries,
    getMyActiveSurveys,
    getMyDraftSurveys,
    getMyClosedSurveys,
    getMyDeletedSurveys
} = require("../controllers/surveyController");

const {
    authMiddleware
} = require("../middlewares/authMiddleware");


/*
|--------------------------------------------------------------------------
| Survey Creation Flow
|--------------------------------------------------------------------------
*/

// Step 1 - Save Survey Details (Draft)
router.post(
    "/save-survey-details",
    authMiddleware,
    saveSurveyDetails
);

// Update Existing Draft Survey Details
router.put(
    "/update-survey-details/:survey_id",
    authMiddleware,
    updateSurveyDetails
);

// Step 2 - Save Questions, Options & Tags
router.post(
    "/save-survey-questions",
    authMiddleware,
    saveSurveyQuestions
);

// Preview Survey
router.get(
    "/preview-survey/:survey_id",
    authMiddleware,
    previewSurvey
);

router.post(
    "/publish-survey",
    authMiddleware,
    publishSurvey
);

router.post(
    "/close-survey",
    authMiddleware,
    closeSurvey
);

router.post(
    "/archive-survey",
    authMiddleware,
    archiveSurvey
);

// My Surveys Listing
router.get(
    "/my-surveys",
    authMiddleware,
    getMySurveys
);

// My Fetch survey for user to participate in
router.get(
    "/survey-for-me",
    authMiddleware,
    getAvailableSurveys
);

// My Survey detals
router.post(
    "/survey-for-me-details",
    authMiddleware,
    getSurveyForMeDetails
);

// Submit answers for an available survey
router.post(
    "/submit-survey",
    authMiddleware,
    submitSurvey
);

/*
|--------------------------------------------------------------------------
| Master Data APIs
|--------------------------------------------------------------------------
*/

// Sector & Industry Hierarchy
router.post(
    "/sector-industry",
    authMiddleware,
    getSectorIndustryHierarchy
);

// Countries
router.post(
    "/countries",
    authMiddleware,
    get_Countries
);


// Sectors
router.post(
    "/sectors",
    authMiddleware,
    getSectors
);


// Company Size
router.post(
    "/company-size",
    authMiddleware,
    get_CompanySize
);

// Company Revenue
router.post(
    "/company-revenue",
    authMiddleware,
    get_CompanyRevenue
);

// Industries
router.post(
    "/industries",
    authMiddleware,
    getIndustries
);

// Get Active Surveys of loggedIn user
router.get(
    "/active-surveys",
    authMiddleware,
    getMyActiveSurveys
);

// Get Draft Surveys of loggedIn user
router.get(
    "/draft-surveys",
    authMiddleware,
    getMyDraftSurveys
);

// Get Closed Surveys of loggedIn user
router.get(
    "/closed-surveys",
    authMiddleware,
    getMyClosedSurveys
);

// Get Deleted Surveys of loggedIn user
router.get(
    "/deleted-surveys",
    authMiddleware,
    getMyDeletedSurveys
);

module.exports = router;
