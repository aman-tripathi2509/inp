const Survey = require("../models/surveyModel");

const QUESTION_IDS = {
    sector: 68,
    industry: 69,
    subIndustry: 70
};
const getSectorIndustryHierarchy = async (req, res) => {
    try {
        // Fetch sectors
        const sectors = await Survey.getSectors(QUESTION_IDS.sector);
        const finalResult = [];

        for (const sector of sectors) {
            // Fetch industries for this sector
            const industries = await Survey.getIndustries(
            QUESTION_IDS.industry,
            sector.question_answer_id
            );
            const industryList = [];

            for (const industry of industries) {
                // Fetch sub-industries for this industry
                const subIndustries = await Survey.getSubIndustries(
                QUESTION_IDS.subIndustry,
                industry.question_answer_id
                );

                industryList.push({
                    id: industry.question_answer_id,
                    name: industry.answer,
                    subIndustries: subIndustries.map(sub => ({
                        id: sub.question_answer_id,
                        name: sub.answer,
                        parentId: sub.parent_answer_id
                    }))
                });
            }

            finalResult.push({
                id: sector.question_answer_id,
                name: sector.answer,
                industries: industryList
            });
        }

        res.status(200).json({
            status: true,
            message: 'Data fetched successfully',
            data: finalResult
        });
    } catch (error) {
        console.error('Error fetching hierarchy:', error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

// Controller function to get Company Size based on question_id
const get_CompanySize = async (req, res) => {
    try {
        const question_id = 11;//for industries questions
        const allCompanySize = await Survey.getCompanySize(question_id);
        // Return the fetched sectors instead of the error message
        res.status(200).json({ message: "Compay Size fetched successfully", data: allCompanySize });
    }
    catch (error) {
        console.error('Error fetching Compay Size:', error);
        res.status(500).json({ message: "Error fetching Compay Size" });
    }
}

// Controller function to get Company Revenue based on question_id
const get_CompanyRevenue = async (req, res) => {
    try {
        const question_id = 12;//for industries questions
        const allCompanyRevenue = await Survey.getCompanyRevenue(question_id);
        // Return the fetched sectors instead of the error message
        res.status(200).json({ message: "Compay Revenue fetched successfully", data: allCompanyRevenue });
    }
    catch (error) {
        console.error('Error fetching Compay Size:', error);
        res.status(500).json({ message: "Error fetching Compay Revenue" });
    }
}

// Controller function to get countries based on question_id
const get_Countries = async (req, res) => {
    try {
        const allSectors = await Survey.getCountries();
        // Return the fetched sectors instead of the error message
        res.status(200).json({ message: "countries fetched successfully", data: allSectors });
    }
    catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ message: "Error fetching countries" });
    }
}

const saveSurveyDetails = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        if (!member_id) {
            return res.status(401).json({
                success: false,
                message: "Member ID not found in token"
            });
        }

        const {
            survey_title,
            survey_description,
            survey_image,
            start_date,
            end_date,
            min_age,
            max_age,
            gender,
            target_responses,
            reward_per_participant,
            sector,
            industry,
            country,
            state
        } = req.body;

        if (!survey_title) {
            return res.status(400).json({
                success: false,
                message: "Survey title is required"
            });
        }

        const result =
            await Survey.createSurveyDetails(
                member_id,
                {
                    survey_title,
                    survey_description,
                    survey_image,
                    start_date,
                    end_date,
                    min_age,
                    max_age,
                    gender,
                    target_responses,
                    reward_per_participant,
                    sector,
                    industry,
                    country,
                    state
                }
            );

        return res.status(201).json({
            success: true,
            message: "Survey details saved successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateSurveyDetails = async (req, res) => {

    try {

        const { survey_id } = req.params;

        await Survey.updateSurveyDetails(
            survey_id,
            req.body
        );

        return res.json({
            success: true,
            message: "Survey updated successfully"
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const saveSurveyQuestions = async (req, res) => {

    try {

        const {
            survey_id,
            questions,
            tags
        } = req.body;

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        if (
            !questions ||
            !Array.isArray(questions)
        ) {

            return res.status(400).json({
                success: false,
                message: "questions array required"
            });
        }

        const allowedTypes = [
            "single_select",
            "multi_select",
            "open_end",
            "dropdown",
            "rating",
            "yes_no",
            "nps"
        ];

        for (const q of questions) {

            if (
                !q.question_text ||
                !q.question_type
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                    "question_text and question_type are required"
                });
            }

            if (
                !allowedTypes.includes(
                    q.question_type
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                    `Invalid question type: ${q.question_type}`
                });
            }

            if (
                q.question_type !== "open_end" &&
                (
                    !q.options ||
                    q.options.length === 0
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                    `${q.question_text} requires options`
                });
            }
        }

        const result =
            await Survey.saveSurveyQuestions(
                survey_id,
                questions,
                tags
            );

        return res.json({
            success: true,
            message:
            "Questions saved successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const previewSurvey = async (req, res) => {

    try {

        const { survey_id } =
            req.params;

        const result =
            await Survey.getSurveyPreview(
                survey_id
            );

        return res.json({
            success: true,
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const publishSurvey = async (req, res) => {

    try {

        const { survey_id } = req.body;

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        const result =
            await Survey.publishSurvey(
                survey_id
            );

        return res.json({
            success: true,
            message: "Survey published successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const closeSurvey = async (req, res) => {

    try {

        const { survey_id } = req.body;

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        const result =
            await Survey.closeSurvey(
                survey_id
            );

        return res.json({
            success: true,
            message: "Survey closed successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const archiveSurvey = async (req, res) => {

    try {

        const { survey_id } = req.body;

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        const result =
            await Survey.archiveSurvey(
                survey_id
            );

        return res.json({
            success: true,
            message: "Survey archived successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getMySurveys = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const status =
            req.query.status !== undefined
                ? parseInt(req.query.status)
                : null;

        const result = await Survey.getMySurveys(
            member_id,
            status
        );

        return res.status(200).json({
            success: true,
            counts: {
                all: Number(result.counts.all_surveys || 0),
                active: Number(result.counts.active_surveys || 0),
                completed: Number(result.counts.completed_surveys || 0),
                draft: Number(result.counts.draft_surveys || 0)
            },
            count: result.surveys.length,
            data: result.surveys
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAvailableSurveys = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const surveys =
            await Survey.getAvailableSurveys(
                member_id
            );

        return res.status(200).json({
            success: true,
            count: surveys.length,
            data: surveys
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getSurveyForMeDetails = async (req, res) => {

    try {

        const { survey_id } = req.body;
        const parsedSurveyId = Number(survey_id);

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        const result =
            await Survey.getSurveyForMeDetails(
                parsedSurveyId,
                req.user.member_id
            );

        if (!result.surveyExists) {
            return res.status(404).json({
                success: false,
                message: "Survey not found"
            });
        }

        if (!result.isAvailable) {
            return res.status(403).json({
                success: false,
                message: "Survey is not available for this user"
            });
        }

        return res.status(200).json({
            success: true,
            count: result.questions.length,
            data: result.questions
        });

    } catch (error) {

        console.error(error);

        if (error.message === "User not found") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const submitSurvey = async (req, res) => {

    try {

        const { survey_id, answers } = req.body;
        const parsedSurveyId = Number(survey_id);

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        if (
            !Array.isArray(answers) ||
            answers.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "answers must be a non-empty array"
            });
        }

        const result = await Survey.submitSurvey(
            parsedSurveyId,
            req.user.member_id,
            answers
        );

        return res.status(201).json({
            success: true,
            message: "Survey submitted successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        const statusCode = error.statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message:
                statusCode === 500
                    ? "Internal Server Error"
                    : error.message
        });
    }
};

const deleteSurveyResponse = async (req, res) => {

    try {

        const { response_id } = req.params;
        const parsedResponseId = Number(response_id);

        if (
            !Number.isInteger(parsedResponseId) ||
            parsedResponseId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid response_id is required"
            });
        }

        const result = await Survey.deleteSurveyResponse(
            parsedResponseId,
            req.user.member_id
        );

        return res.status(200).json({
            success: true,
            message: "Survey response deleted successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        const statusCode = error.statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message:
                statusCode === 500
                    ? "Internal Server Error"
                    : error.message
        });
    }
};



/**
 * Get Sectors
 */
const getSectors = async (req, res) => {
    try {

        const sectors = await Survey.getSectors(68);

        return res.status(200).json({
            success: true,
            message: "Sectors fetched successfully",
            data: sectors
        });

    } catch (error) {
        console.error("Error fetching sectors:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

/**
 * Get Indusctries based on sector_id
 */

const getIndustries = async (req, res) => {
    try {

        const { sector_id } = req.body;
        if (!sector_id) {
            return res.status(400).json({
                success: false,
                message: "sector_id is required in request body"
            });
        }
        const industries = await Survey.getIndustries(69, sector_id);

        return res.status(200).json({
            success: true,
            message: "Industries fetched successfully",
            data: industries
        });

    } catch (error) {
        console.error("Error fetching industries:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const createMySurveyStatusHandler = (
    modelMethod,
    statusLabel
) => async (req, res) => {
    try {
        const member_id = req.user.member_id;
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const parsedCursor = Number.parseInt(req.query.cursor, 10);
        const limit = req.query.limit === undefined ? 15 : parsedLimit;
        const cursor = req.query.cursor === undefined ? null : parsedCursor;

        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return res.status(400).json({
                success: false,
                message: "limit must be an integer between 1 and 50"
            });
        }

        if (
            cursor !== null &&
            (!Number.isInteger(cursor) || cursor < 1)
        ) {
            return res.status(400).json({
                success: false,
                message: "cursor must be a positive integer"
            });
        }

        const result = await modelMethod(
            member_id,
            cursor,
            limit
        );

        return res.status(200).json({
            success: true,
            message: `My ${statusLabel} surveys fetched successfully`,
            count: result.surveys.length,
            totalCount: result.totalCount,
            data: result.surveys,
            pagination: {
                limit,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore
            }
        });

    } catch (error) {
        console.error(`Error fetching my ${statusLabel} surveys:`, error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const getMyActiveSurveys = createMySurveyStatusHandler(
    Survey.getMyActiveSurveys,
    "active"
);

const getMyDraftSurveys = createMySurveyStatusHandler(
    Survey.getMyDraftSurveys,
    "draft"
);

const getMyClosedSurveys = createMySurveyStatusHandler(
    Survey.getMyClosedSurveys,
    "closed"
);

const getMyDeletedSurveys = createMySurveyStatusHandler(
    Survey.getMyDeletedSurveys,
    "deleted"
);

const getSurveyDetails = async (req, res) => {

    try {

        const { survey_id } = req.params;
        const parsedSurveyId = Number(survey_id);
        const member_id = req.user.member_id;

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        const result = await Survey.getSurveyDetails(
            parsedSurveyId,
            member_id
        );

        return res.status(200).json({
            success: true,
            message: "Survey details fetched successfully",
            data: result
        });

    }catch(error){
        console.error("Error fetching survey details:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }


}

const getSurveyQuestions = async (req, res) => {
     
     try {

        const { survey_id } = req.params;
        const parsedSurveyId = Number(survey_id);
        const member_id = req.user.member_id;

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        const result = await Survey.getSurveyQuestions(
            parsedSurveyId,
            member_id
        );

        return res.status(200).json({
            success: true,
            message: "Survey questions fetched successfully",
            data: result
        });

    }catch(error){
        console.error("Error fetching survey questions:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }

}

module.exports = {saveSurveyDetails,
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
    getSectors,
    getMyActiveSurveys,
    getMyDraftSurveys,
    getMyClosedSurveys,
    getMyDeletedSurveys,
     getSectorIndustryHierarchy, get_Countries, get_CompanySize, get_CompanyRevenue, getIndustries,
    getSurveyDetails,
getSurveyQuestions,
deleteSurveyResponse};
