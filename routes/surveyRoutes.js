const express = require("express");
const router = express.Router();

const {
    saveSurveyDetails,
    updateSurveyDetails,
    saveSurveyQuestions,
    updateSurveyQuestions,
    previewSurvey,
    publishSurvey,
    closeSurvey,
    archiveSurvey,
    saveSurvey,
    getSavedSurveys,
    removeSavedSurvey,
    getMySurveys,
    
    getMySurveyOverview,
    getSurveyResponses,
    
    getSurveyForMe,
    getSurveyForMeDetails,
    submitSurvey,
    get_Countries,
    get_CompanySize,
    get_CompanyRevenue,
    get_CompanyType,
    getSectorIndustryHierarchy,
    getSectors,
    getIndustries,
    getSurveyDetails,
    getSurveyQuestions,
    deleteSurveyResponse,
    previewSubmittedSurvey,
    completeSurvey,
    cloneSurvey,
    toggleSurveyLike,
    addSurveyComment,
    toggleCommentLike,
    getSurveyComments,
    testSurveyInteraction,
    getSurveyLikes,
    getCommentReplies,
    
    getMySurveyEngagement,
    getMySurveyCommentReplies,
    toggleMySurveyCommentLike,
    addMySurveyCommentReply
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

router.put(
    "/update-survey-questions/:survey_id",
    authMiddleware,
    uploadSurveyImages,
    updateSurveyQuestions
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


router.get(
    "/my-surveys/:survey_id/overview",
    authMiddleware,
    getMySurveyOverview
);

router.get(
    "/my-surveys/:survey_id/responses",
    authMiddleware,
    getSurveyResponses
);


// My Fetch survey for user to participate in
router.get(
    "/survey-for-me",
    authMiddleware,
    getSurveyForMe
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

// Company Type
router.post(
    "/company-type",
    authMiddleware,
    get_CompanyType
);

// Industries
router.post(
    "/industries",
    getIndustries
);

router.post(
    "/clone-survey",
    authMiddleware,
    cloneSurvey
);

router.post(
    "/like-OnSurvey",
    authMiddleware,
    toggleSurveyLike
);

router.post(
    "/comment-OnSurvey",
    authMiddleware,
    addSurveyComment
);

router.post(
    "/like-OnComment",
    authMiddleware,
    toggleCommentLike
);

router.get(
    "/survey-comments/:survey_id",
    authMiddleware,
    getSurveyComments
);

router.get(
    "/comment-replies/:comment_id",
    authMiddleware,
    getCommentReplies
);

router.get(
    "/fetch-survey-likes/:survey_id",
    authMiddleware,
    getSurveyLikes
);

router.post(
    "/test-survey-interaction",
    authMiddleware,
    testSurveyInteraction
);

router.get(
    "/my-surveys/:survey_id/engagement",
    authMiddleware,
    getMySurveyEngagement
);

router.get(
    "/my-surveys/:survey_id/engagement/comments/:comment_id/replies",
    authMiddleware,
    getMySurveyCommentReplies
);

router.post(
    "/my-surveys/:survey_id/engagement/comments/:comment_id/like",
    authMiddleware,
    toggleMySurveyCommentLike
);

router.post(
    "/my-surveys/:survey_id/engagement/comments/:comment_id/reply",
    authMiddleware,
    addMySurveyCommentReply
);

module.exports = router;
