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
    saveSurvey,
    getSavedSurveys,
    removeSavedSurvey,
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
    getSurveyDetails,
    getSurveyQuestions,
    deleteSurveyResponse,
    previewSubmittedSurvey,
    completeSurvey
} = require("../controllers/surveyController");

const {
    authMiddleware
} = require("../middlewares/authMiddleware");
const {
    uploadSurveyImages
} = require("../middlewares/surveyUploadMiddleware");


/*
|--------------------------------------------------------------------------
| Survey Creation Flow
|--------------------------------------------------------------------------
*/

// Step 1 - Save Survey Details (Draft)
router.post(
    "/save-survey-details",
    authMiddleware,
    uploadSurveyImages,
    saveSurveyDetails
);

// Update Existing Draft Survey Details
router.put(
    "/update-survey-details/:survey_id",
    authMiddleware,
    uploadSurveyImages,
    updateSurveyDetails
);

// Step 2 - Save Questions, Options & Tags
router.post(
    "/save-survey-questions",
    authMiddleware,
    uploadSurveyImages,
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

router.post(
    "/save-survey",
    authMiddleware,
    saveSurvey
);

router.get(
    "/fetch-saved-surveys",
    authMiddleware,
    getSavedSurveys
);

router.delete(
    "/remove-saved-survey",
    authMiddleware,
    removeSavedSurvey
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

router.get(
    "/preview-submitted-survey/:survey_id",
    authMiddleware,
    previewSubmittedSurvey
);

router.post(
    "/complete-survey",
    authMiddleware,
    completeSurvey
);

// Delete submitted survey response and selected options
router.delete(
    "/survey-response/:response_id",
    authMiddleware,
    deleteSurveyResponse
);

// Get Survey details for loggedIn user
router.get(
    "/survey-details/:survey_id",
    authMiddleware,
    getSurveyDetails
);

// Get Questions for loggedIn user
router.get(
    "/survey-questions/:survey_id",
    authMiddleware,
    getSurveyQuestions
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
    get_Countries
);


// Sectors
router.post(
    "/sectors",
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
    getIndustries
);



module.exports = router;
