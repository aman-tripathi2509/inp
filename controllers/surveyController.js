const Survey = require("../models/surveyModel");

const { getIO } = require("../socket");

const fileUrl = (file) => `/uploads/surveys/${file.filename}`;

const { aesDecrypt } = require("../utils/encryption");

const parseMultiSelect = (value) => {
    if (!value) return "";

    try {
        return JSON.parse(value).join(",");
    } catch (err) {
        return value;
    }
};

const getAgeRange = (value) => {

    if (!value) {
        return {
            min_age: null,
            max_age: null
        };
    }

    let ageGroups = [];

    try {
        ageGroups = JSON.parse(value);
    } catch {
        ageGroups = Array.isArray(value) ? value : [value];
    }

    let minAge = Number.MAX_SAFE_INTEGER;
    let maxAge = 0;

    ageGroups.forEach(group => {

        if (group === "60+") {

            minAge = Math.min(minAge, 60);
            maxAge = Math.max(maxAge, 100);

        } else {

            const [min, max] = group.split("-").map(Number);

            minAge = Math.min(minAge, min);
            maxAge = Math.max(maxAge, max);
        }

    });

    return {
        min_age: minAge,
        max_age: maxAge
    };
};

const parseJsonField = (value, fallback) => {
    if (typeof value !== "string") {
        return value ?? fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

const getUploadedFileMap = (files = []) => {
    return files.reduce((map, file) => {
        if (!map[file.fieldname]) {
            map[file.fieldname] = [];
        }

        map[file.fieldname].push(file);

        return map;
    }, {});
};

const firstFileUrl = (fileMap, fieldNames) => {
    for (const fieldName of fieldNames) {
        if (fileMap[fieldName] && fileMap[fieldName][0]) {
            return fileUrl(fileMap[fieldName][0]);
        }
    }

    return null;
};

const normalizeSurveyQuestionImages = (questions, files = []) => {
    const fileMap = getUploadedFileMap(files);
    const questionImageQueue = [...(fileMap.question_images || [])];
    const optionImageQueue = [...(fileMap.option_images || [])];

    return questions.map((question, questionIndex) => {
        const normalizedQuestion = {
            ...question
        };

        normalizedQuestion.question_image =
            firstFileUrl(
                fileMap,
                [
                    `questions[${questionIndex}][question_image]`,
                    `questions[${questionIndex}].question_image`,
                    `question_image_${questionIndex}`
                ]
            ) ||
            (
                questionImageQueue.length
                    ? fileUrl(questionImageQueue.shift())
                    : normalizedQuestion.question_image
            ) ||
            null;

        if (Array.isArray(normalizedQuestion.options)) {
            normalizedQuestion.options =
                normalizedQuestion.options.map((option, optionIndex) => {
                    return {
                        ...option,
                        option_image:
                            firstFileUrl(
                                fileMap,
                                [
                                    `questions[${questionIndex}][options][${optionIndex}][option_image]`,
                                    `questions[${questionIndex}].options[${optionIndex}].option_image`,
                                    `option_image_${questionIndex}_${optionIndex}`
                                ]
                            ) ||
                            (
                                optionImageQueue.length
                                    ? fileUrl(optionImageQueue.shift())
                                    : option.option_image
                            ) ||
                            null
                    };
                });
        }

        return normalizedQuestion;
    });
};

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

// Controller function to get Company Revenue based on question_id
const get_CompanyType = async (req, res) => {
    try {
        const question_id = 9;//for industries questions
        const allCompanyType = await Survey.getCompanyType(question_id);
        // Return the fetched sectors instead of the error message
        res.status(200).json({ message: "Compay Type fetched successfully", data: allCompanyType });
    }
    catch (error) {
        console.error('Error fetching Compay Type:', error);
        res.status(500).json({ message: "Error fetching Compay Type" });
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
            age_groups,
            gender,
            target_responses,
            reward_per_participant,
            sector,
            industry,
            country,
            state
        } = req.body;

        const uploadedSurveyImage =
            firstFileUrl(
                getUploadedFileMap(req.files),
                ["survey_image"]
            );

        if (!survey_title) {
            return res.status(400).json({
                success: false,
                message: "Survey title is required"
            });
        }

        const ageRange = getAgeRange(age_groups);
        const result = await Survey.createSurveyDetails(
            member_id,
            {
                survey_title,
                survey_description,
                survey_image: uploadedSurveyImage || survey_image,
                start_date,
                end_date,
                min_age: ageRange.min_age,
                max_age: ageRange.max_age,
                gender: parseMultiSelect(gender),
                target_responses,
                reward_per_participant,

                sector: parseMultiSelect(sector),
                industry: parseMultiSelect(industry),
                country: parseMultiSelect(country),
                state: parseMultiSelect(state)
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
        const uploadedSurveyImage =
            firstFileUrl(
                getUploadedFileMap(req.files),
                ["survey_image"]
            );

        await Survey.updateSurveyDetails(
            survey_id,
            {
                ...req.body,
                survey_image: uploadedSurveyImage || req.body.survey_image
            }
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
        const parsedQuestions = parseJsonField(questions, null);
        const parsedTags = parseJsonField(tags, []);

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        if (
            !parsedQuestions ||
            !Array.isArray(parsedQuestions)
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

        const normalizedQuestions = normalizeSurveyQuestionImages(
            parsedQuestions,
            req.files
        );

        for (const q of normalizedQuestions) {

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
                normalizedQuestions,
                parsedTags
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


const updateSurveyQuestions = async (req, res) => {

    try {

        const { survey_id } = req.params;

        const {
            questions,
            tags
        } = req.body;

        const parsedQuestions = parseJsonField(questions, null);
        const parsedTags = parseJsonField(tags, []);

        if (!survey_id) {
            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        if (
            !parsedQuestions ||
            !Array.isArray(parsedQuestions)
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

        const normalizedQuestions =
            normalizeSurveyQuestionImages(
                parsedQuestions,
                req.files
            );

        for (const q of normalizedQuestions) {

            if (
                !q.question_text ||
                !q.question_type
            ) {
                return res.status(400).json({
                    success: false,
                    message: "question_text and question_type are required"
                });
            }

            if (
                !allowedTypes.includes(
                    q.question_type
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid question type: ${q.question_type}`
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
                    message: `${q.question_text} requires options`
                });
            }
        }

        const result =
            await Survey.updateSurveyQuestions(
                survey_id,
                normalizedQuestions,
                parsedTags
            );

        return res.status(200).json({
            success: true,
            message: "Survey questions updated successfully",
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

        const { survey_id } = req.params;

        if (!survey_id) {
            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        const result = await Survey.getSurveyPreview(survey_id);

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        // ================= Survey Image =================

        if (result.survey?.survey_image) {
            result.survey.survey_image =
                `${baseUrl}${result.survey.survey_image}`;
        }

        // ================= Question & Option Images =================

        if (Array.isArray(result.questions)) {

            result.questions = result.questions.map(question => {

                if (question.question_image) {
                    question.question_image =
                        `${baseUrl}${question.question_image}`;
                }

                if (Array.isArray(question.options)) {

                    question.options = question.options.map(option => {

                        if (option.option_image) {
                            option.option_image =
                                `${baseUrl}${option.option_image}`;
                        }

                        return option;
                    });
                }

                return question;
            });
        }

        return res.status(200).json({
            success: true,
            message: "Survey preview fetched successfully",
            data: result
        });

    } catch (error) {

        console.error("Preview Survey Error:", error);

        if (error.message === "Survey not found") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
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

const saveSurvey = async (req, res) => {

    try {

        const member_id = req.user.member_id;
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

        const result = await Survey.saveSurvey(
            member_id,
            parsedSurveyId
        );

        return res.status(201).json({
            success: true,
            message: "Survey saved successfully",
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

const getSavedSurveys = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const surveys =
            await Survey.getSavedSurveys(member_id);

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

const removeSavedSurvey = async (req, res) => {

    try {

        const member_id = req.user.member_id;
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

        const result = await Survey.removeSavedSurvey(
            member_id,
            parsedSurveyId
        );

        return res.status(200).json({
            success: true,
            message: "Survey removed from saved successfully",
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
                ? Number(req.query.status)
                : null;

        const cursor =
            req.query.cursor !== undefined
                ? Number(req.query.cursor)
                : null;

        const limit =
            req.query.limit !== undefined
                ? Number(req.query.limit)
                : 15;

        const search =
            req.query.search?.trim() || null;

        if (
            status !== null &&
            ![0, 1, 2, 3].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        if (
            cursor !== null &&
            (!Number.isInteger(cursor) || cursor <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid cursor"
            });
        }

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 50
        ) {
            return res.status(400).json({
                success: false,
                message: "limit must be between 1 and 50"
            });
        }

        const result = await Survey.getMySurveys(
            member_id,
            status,
            cursor,
            limit,
            search
        );

        return res.status(200).json({
            success: true,
            message: "My surveys fetched successfully",

            counts: result.counts,

            totalCount: result.totalCount,

            count: result.surveys.length,

            data: result.surveys,

            pagination: {
                limit,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore
            }
        });

    } catch (error) {

        console.error("Error fetching my surveys:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const getSurveyForMe = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const tab = req.query.tab || "available";

        const surveys = await Survey.getSurveyForMe(
            member_id,
            tab
        );

        return res.status(200).json({
            success: true,
            tab,
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

        const { survey_id, question_id, answer, option_ids } = req.body;

        const parsedSurveyId = Number(survey_id);
        const parsedQuestionId = Number(question_id);

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
            !Number.isInteger(parsedQuestionId) ||
            parsedQuestionId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid question_id is required"
            });
        }

        const result = await Survey.submitSurvey(
            parsedSurveyId,
            req.user.member_id,
            parsedQuestionId,
            { answer, option_ids }
        );

        return res.status(201).json({
            success: true,
            message: result.saved
                ? "Answer submitted successfully"
                : "No answer provided for this question",
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

const previewSubmittedSurvey = async (req, res) => {

    try {

        const survey_id = Number(req.params.survey_id);

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        const result = await Survey.previewSubmittedSurvey(
            survey_id,
            req.user.member_id
        );

        return res.status(200).json({
            success: true,
            message: "Survey preview fetched successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Internal Server Error"
        });
    }
};

const completeSurvey = async (req, res) => {

    try {

        const survey_id = Number(req.body.survey_id);

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required"
            });
        }

        const result =
            await Survey.completeSurvey(
                survey_id,
                req.user.member_id
            );

        return res.status(200).json({
        success: true,
        message: result.message,
        data: result
    });

    } catch (error) {

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
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

        if (!sector_id || sector_id.length === 0) {
            return res.status(400).json({
                success: false,
                message: "sector_id is required"
            });
        }

        const sectorIds = Array.isArray(sector_id)
            ? sector_id
            : [sector_id];

        const industries = await Survey.getIndustries(69, sectorIds);

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

const cloneSurvey = async (req, res) => {

    try {

        const member_id = req.user.member_id;
        const { survey_id } = req.body;

        if (!survey_id) {
            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });
        }

        const result = await Survey.cloneSurvey(
            survey_id,
            member_id
        );

        return res.status(201).json({
            success: true,
            message: "Survey cloned successfully",
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


const toggleSurveyLike = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const { survey_id } = req.body;

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required"
            });

        }

        //--------------------------------------------------
        // Toggle Like
        //--------------------------------------------------

        const result = await Survey.toggleSurveyLike(
            survey_id,
            member_id
        );

        // Emit realtime update
        const io = getIO();

        io.to(`survey_${survey_id}`).emit(
            "survey_like_updated",
            result
        );

        return res.status(200).json({

            success: true,

            message: result.liked
                ? "Survey liked successfully."
                : "Survey unliked successfully.",

            data: result

        });

    } catch (error) {

        console.error("Toggle Survey Like Error:", error);

        return res.status(error.statusCode || 500).json({

            success: false,

            message: error.message || "Internal Server Error"

        });

    }

};



const addSurveyComment = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const {
            survey_id,
            comment,
            reply_to_comment_id
        } = req.body;

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        if (!survey_id) {

            return res.status(400).json({
                success: false,
                message: "survey_id is required."
            });
        }

        if (!comment || !comment.trim()) {

            return res.status(400).json({
                success: false,
                message: "Comment is required."
            });
        }

        //--------------------------------------------------
        // Validate reply_to_comment_id if provided
        //--------------------------------------------------

        let parsedReplyToCommentId = null;

        if (
            reply_to_comment_id !== undefined &&
            reply_to_comment_id !== null &&
            reply_to_comment_id !== ""
        ) {

            parsedReplyToCommentId =
                Number(reply_to_comment_id);

            if (
                !Number.isInteger(parsedReplyToCommentId) ||
                parsedReplyToCommentId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Valid reply_to_comment_id is required."
                });
            }
        }

        //--------------------------------------------------
        // Add Comment / Reply
        //--------------------------------------------------

        const result = await Survey.addSurveyComment(
            survey_id,
            member_id,
            comment.trim(),
            parsedReplyToCommentId
        );

        //--------------------------------------------------
        // Emit realtime update
        //--------------------------------------------------

        const io = getIO();

        io.to(`survey_${survey_id}`).emit(
            "survey_comment_added",
            result
        );

        //--------------------------------------------------
        // Response
        //--------------------------------------------------

        return res.status(200).json({

            success: true,

            message: parsedReplyToCommentId
                ? "Reply added successfully."
                : "Comment added successfully.",

            data: result
        });

    } catch (error) {

        console.error(
            "Add Survey Comment Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });
    }
};



const toggleCommentLike = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const { comment_id } = req.body;

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        if (!comment_id) {

            return res.status(400).json({
                success: false,
                message: "comment_id is required."
            });

        }

        //--------------------------------------------------
        // Toggle Comment Like
        //--------------------------------------------------

        const result = await Survey.toggleCommentLike(
            comment_id,
            member_id
        );

        //--------------------------------------------------
        // Emit realtime update
        //--------------------------------------------------

        const io = getIO();

        io.to(`survey_${result.survey_id}`).emit(
            "comment_like_updated",
            result
        );

        return res.status(200).json({

            success: true,

            message: result.liked
                ? "Comment liked successfully."
                : "Comment unliked successfully.",

            data: result

        });

    } catch (error) {

        console.error("Toggle Comment Like Error:", error);

        return res.status(error.statusCode || 500).json({

            success: false,

            message: error.message || "Internal Server Error"

        });

    }

};




const testSurveyInteraction = async (req, res) => {

    try {

        const { comment_id } = req.body;

        const result = await Survey.toggleCommentLike(
            comment_id,
            req.user.member_id
        );

        return res.status(200).json({
            success: true,
            message: result.liked
                ? "Comment liked successfully."
                : "Comment unliked successfully.",
            data: result
        });

    } catch (error) {

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });

    }

};


const getSurveyComments = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const { survey_id } = req.params;

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        const parsedSurveyId = Number(survey_id);

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message: "Valid survey_id is required."

            });

        }

        //--------------------------------------------------
        // Fetch Comments
        //--------------------------------------------------

        const result = await Survey.getSurveyComments(
            parsedSurveyId,
            member_id
        );

        return res.status(200).json({

            success: true,

            count: result.length,

            data: result

        });

    } catch (error) {

        console.error(
            "Fetch Survey Comments Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });

    }

};

const getCommentReplies = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const { comment_id } = req.params;

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        const parsedCommentId =
            Number(comment_id);

        if (
            !Number.isInteger(parsedCommentId) ||
            parsedCommentId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid comment_id is required."

            });
        }

        //--------------------------------------------------
        // Fetch Replies
        //--------------------------------------------------

        const result =
            await Survey.getCommentReplies(
                parsedCommentId,
                member_id
            );

        //--------------------------------------------------
        // Response
        //--------------------------------------------------

        return res.status(200).json({

            success: true,

            count: result.length,

            data: result

        });

    } catch (error) {

        console.error(
            "Fetch Comment Replies Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });
    }
};


const getSurveyLikes = async (req, res) => {

    try {

        const { survey_id } = req.params;

        const parsedSurveyId = Number(survey_id);

        if (
            !Number.isInteger(parsedSurveyId) ||
            parsedSurveyId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required."
            });
        }

        const result = await Survey.getSurveyLikes(parsedSurveyId);

        return res.status(200).json({
            success: true,
            count: result.length,
            data: result
        });

    } catch (error) {

        console.error("Fetch Survey Likes Error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });

    }

};


const getMySurveyEngagement = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const survey_id =
            Number(req.params.survey_id);

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid survey_id is required."
            });
        }

        const result =
            await Survey.getMySurveyEngagement(
                survey_id,
                member_id
            );

        return res.status(200).json({
            success: true,
            message:
                "Survey engagement fetched successfully",

            data: result
        });

    } catch (error) {

        console.error(
            "Get My Survey Engagement Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({
            success: false,
            message:
                error.message ||
                "Internal Server Error"
        });
    }
};

const getMySurveyCommentReplies = async (req, res) => {

    try {

        const member_id =
            req.user.member_id;

        const survey_id =
            Number(req.params.survey_id);

        const comment_id =
            Number(req.params.comment_id);

        //--------------------------------------------------
        // Validate Survey ID
        //--------------------------------------------------

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid survey_id is required."
            });
        }

        //--------------------------------------------------
        // Validate Comment ID
        //--------------------------------------------------

        if (
            !Number.isInteger(comment_id) ||
            comment_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid comment_id is required."
            });
        }

        //--------------------------------------------------
        // Fetch Replies
        //--------------------------------------------------

        const result =
            await Survey.getMySurveyCommentReplies(
                survey_id,
                comment_id,
                member_id
            );

        //--------------------------------------------------
        // Response
        //--------------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Survey comment replies fetched successfully.",

            count: result.length,

            data: result

        });

    } catch (error) {

        console.error(
            "Get My Survey Comment Replies Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });
    }
};


const toggleMySurveyCommentLike = async (req, res) => {

    try {

        const member_id =
            req.user.member_id;

        const survey_id =
            Number(req.params.survey_id);

        const comment_id =
            Number(req.params.comment_id);

        //--------------------------------------------------
        // Validate Survey ID
        //--------------------------------------------------

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid survey_id is required."
            });
        }

        //--------------------------------------------------
        // Validate Comment ID
        //--------------------------------------------------

        if (
            !Number.isInteger(comment_id) ||
            comment_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid comment_id is required."
            });
        }

        //--------------------------------------------------
        // Toggle Like
        //--------------------------------------------------

        const result =
            await Survey.toggleMySurveyCommentLike(
                survey_id,
                comment_id,
                member_id
            );

        //--------------------------------------------------
        // Socket.IO
        //--------------------------------------------------

        const io = getIO();

        io.to(`survey_${survey_id}`).emit(
            "comment_like_updated",
            result
        );

        //--------------------------------------------------
        // Response
        //--------------------------------------------------

        return res.status(200).json({

            success: true,

            message: result.liked
                ? "Comment liked successfully."
                : "Comment unliked successfully.",

            data: result

        });

    } catch (error) {

        console.error(
            "Toggle My Survey Comment Like Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });
    }
};

const addMySurveyCommentReply = async (req, res) => {

    try {

        const member_id =
            req.user.member_id;

        const survey_id =
            Number(req.params.survey_id);

        const comment_id =
            Number(req.params.comment_id);

        const {
            comment,
            reply_to_comment_id = null
        } = req.body;

        //--------------------------------------------------
        // Validate Survey ID
        //--------------------------------------------------

        if (
            !Number.isInteger(survey_id) ||
            survey_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid survey_id is required."
            });
        }

        //--------------------------------------------------
        // Validate Comment ID
        //--------------------------------------------------

        if (
            !Number.isInteger(comment_id) ||
            comment_id <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid comment_id is required."
            });
        }

        //--------------------------------------------------
        // Validate Comment
        //--------------------------------------------------

        if (
            typeof comment !== "string" ||
            !comment.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Comment is required."
            });
        }

        //--------------------------------------------------
        // Validate Reply Target
        //--------------------------------------------------

        let parsedReplyToCommentId = null;

        if (reply_to_comment_id !== null) {

            parsedReplyToCommentId =
                Number(reply_to_comment_id);

            if (
                !Number.isInteger(
                    parsedReplyToCommentId
                ) ||
                parsedReplyToCommentId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid reply_to_comment_id."
                });
            }
        }

        //--------------------------------------------------
        // Add Reply
        //--------------------------------------------------

        const result =
            await Survey.addMySurveyCommentReply(
                survey_id,
                comment_id,
                member_id,
                comment.trim(),
                parsedReplyToCommentId
            );

        //--------------------------------------------------
        // Socket.IO
        //--------------------------------------------------

        const io = getIO();

        io.to(`survey_${survey_id}`).emit(
            "comment_added",
            result
        );

        //--------------------------------------------------
        // Response
        //--------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                "Reply added successfully.",

            data: result

        });

    } catch (error) {

        console.error(
            "Add My Survey Comment Reply Error:",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal Server Error"

        });
    }
};


module.exports = {
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
    getSurveyForMe,
    getSurveyForMeDetails,
    submitSurvey,
    previewSubmittedSurvey,
    completeSurvey,
    getSectors,
    getSectorIndustryHierarchy,
    get_Countries,
    get_CompanySize,
    get_CompanyRevenue,
    get_CompanyType,
    getIndustries,
    getSurveyDetails,
    getSurveyQuestions,
    deleteSurveyResponse,
    cloneSurvey,
    toggleSurveyLike,
    addSurveyComment,
    toggleCommentLike,
    getSurveyComments,
    getCommentReplies,
    testSurveyInteraction,
    getSurveyLikes,

    getMySurveyEngagement,
    getMySurveyCommentReplies,
    toggleMySurveyCommentLike,
    addMySurveyCommentReply
    
    };
