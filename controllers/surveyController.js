const Survey = require("../models/surveyModel");

const fileUrl = (file) => `/uploads/surveys/${file.filename}`;

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

const getAvailableSurveys = async (req, res) => {

    try {

        const member_id = req.user.member_id;

        const surveys = await Survey.getAvailableSurveys(member_id);

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
            message: "Survey submitted successfully",
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

module.exports = {
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
    cloneSurvey
    };
