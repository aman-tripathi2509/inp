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
    get_Countries,
    get_CompanySize,
    get_CompanyRevenue,
    getSectorIndustryHierarchy
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

module.exports = router;