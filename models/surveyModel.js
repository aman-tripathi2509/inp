const db = require("../config/db");// getting the database connection

const createSurveyDetails = async (
    member_id,
    surveyData
) => {

    const [result] = await db.query(
        `
        INSERT INTO inp_survey
        (
            member_id,
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
            state,
            status
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            member_id,
            surveyData.survey_title,
            surveyData.survey_description,
            surveyData.survey_image,
            surveyData.start_date,
            surveyData.end_date,
            surveyData.min_age,
            surveyData.max_age,
            surveyData.gender,
            surveyData.target_responses,
            surveyData.reward_per_participant,
            surveyData.sector,
            surveyData.industry,
            surveyData.country,
            surveyData.state,
            0
        ]
    );

    return {
        survey_id: result.insertId
    };
};

const updateSurveyDetails = async (
    survey_id,
    surveyData
) => {

    await db.query(
        `
        UPDATE inp_survey
        SET
            survey_title=?,
            survey_description=?,
            survey_image=?,
            start_date=?,
            end_date=?,
            min_age=?,
            max_age=?,
            gender=?,
            target_responses=?,
            reward_per_participant=?,
            sector=?,
            industry=?,
            country=?,
            state=?
        WHERE id=?
        `,
        [
            surveyData.survey_title,
            surveyData.survey_description,
            surveyData.survey_image,
            surveyData.start_date,
            surveyData.end_date,
            surveyData.min_age,
            surveyData.max_age,
            surveyData.gender,
            surveyData.target_responses,
            surveyData.reward_per_participant,
            surveyData.sector,
            surveyData.industry,
            surveyData.country,
            surveyData.state,
            survey_id
        ]
    );

    return true;
};

const saveSurveyQuestions = async (
    survey_id,
    questions,
    tags = []
) => {

    let connection;

    try {

        connection = await db.getConnection();

        await connection.beginTransaction();

        await connection.query(
            `
            DELETE o
            FROM inp_survey_question_option o
            INNER JOIN inp_survey_question q
            ON o.question_id=q.id
            WHERE q.survey_id=?
            `,
            [survey_id]
        );

        await connection.query(
            `
            DELETE FROM inp_survey_question
            WHERE survey_id=?
            `,
            [survey_id]
        );

        await connection.query(
            `
            DELETE FROM inp_survey_tags
            WHERE survey_id=?
            `,
            [survey_id]
        );

        for (let i = 0; i < questions.length; i++) {

            const q = questions[i];

            const [questionResult] =
                await connection.query(
                    `
                    INSERT INTO
                    inp_survey_question
                    (
                        survey_id,
                        question_text,
                        question_type,
                        question_image,
                        is_required,
                        question_order
                    )
                    VALUES
                    (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        survey_id,
                        q.question_text,
                        q.question_type,
                        q.question_image || null,
                        q.is_required ? 1 : 0,
                        i + 1
                    ]
                );

            const question_id =
                questionResult.insertId;

            if (
                q.options &&
                q.options.length > 0
            ) {

                for (
                    let j = 0;
                    j < q.options.length;
                    j++
                ) {

                    await connection.query(
                        `
                        INSERT INTO
                        inp_survey_question_option
                        (
                            survey_id,
                            question_id,
                            option_text,
                            option_image,
                            option_order
                        )
                        VALUES
                        (?, ?, ?, ?, ?)
                        `,
                        [
                            survey_id,
                            question_id,
                            q.options[j].option_text,
                            q.options[j].option_image || null,
                            j + 1
                        ]
                    );
                }
            }
        }

        if (
            tags &&
            tags.length > 0
        ) {

            for (const tag of tags) {

                await connection.query(
                    `
                    INSERT INTO inp_survey_tags
                    (
                        survey_id,
                        tag_name
                    )
                    VALUES
                    (?, ?)
                    `,
                    [
                        survey_id,
                        tag
                    ]
                );
            }
        }

        await connection.commit();

        return {
            survey_id,
            total_questions:
                questions.length
        };

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        throw error;

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

const getSurveyPreview = async (
    survey_id
) => {

    const [surveyRows] =
        await db.query(
            `
            SELECT *
            FROM inp_survey
            WHERE id=?
            `,
            [survey_id]
        );

    const survey =
        surveyRows[0];

    const [questions] =
        await db.query(
            `
            SELECT *
            FROM inp_survey_question
            WHERE survey_id=?
            ORDER BY question_order
            `,
            [survey_id]
        );

    for (const question of questions) {

        const [options] =
            await db.query(
                `
                SELECT *
                FROM inp_survey_question_option
                WHERE question_id=?
                ORDER BY option_order
                `,
                [question.id]
            );

        question.options =
            options;
    }

    const [tags] =
        await db.query(
            `
            SELECT tag_name
            FROM inp_survey_tags
            WHERE survey_id=?
            `,
            [survey_id]
        );

    return {
        survey,
        questions,
        tags
    };
};

const publishSurvey = async (survey_id) => {

    const [result] = await db.query(
        `
        UPDATE inp_survey
        SET status = 1
        WHERE id = ?
        `,
        [survey_id]
    );

    return {
        survey_id,
        affectedRows: result.affectedRows
    };
};

const closeSurvey = async (survey_id) => {

    const [result] = await db.query(
        `
        UPDATE inp_survey
        SET status = 2
        WHERE id = ?
        `,
        [survey_id]
    );

    return {
        survey_id,
        affectedRows: result.affectedRows
    };
};

const archiveSurvey = async (survey_id) => {

    const [result] = await db.query(
        `
        UPDATE inp_survey
        SET status = 3
        WHERE id = ?
        `,
        [survey_id]
    );

    return {
        survey_id,
        affectedRows: result.affectedRows
    };
};


const getMySurveys = async (member_id, status = null) => {

    try {

        // Get counts
        const countQuery = `
            SELECT
                COUNT(*) AS all_surveys,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_surveys,
                SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS completed_surveys,
                SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS draft_surveys
            FROM inp_survey
            WHERE member_id = ?
              AND status != 3
        `;

        const [[counts]] = await db.query(countQuery, [member_id]);

        // Get survey listing
        let surveyQuery = `
            SELECT *
            FROM inp_survey
            WHERE member_id = ?
        `;

        const params = [member_id];

        if (status !== null) {
            surveyQuery += ` AND status = ?`;
            params.push(status);
        }

        surveyQuery += ` ORDER BY id DESC`;

        const [surveys] = await db.query(surveyQuery, params);

        return {
            counts,
            surveys
        };

    } catch (error) {
        throw error;
    }
};

const getMySurveysByStatus = async (
    member_id,
    status,
    cursor = null,
    limit = 15
) => {
    const countQuery = `
        SELECT COUNT(*) AS total
        FROM inp_survey
        WHERE member_id = ?
          AND status = ?
    `;

    const [[countResult]] = await db.query(
        countQuery,
        [member_id, status]
    );

    let surveyQuery = `
        SELECT *
        FROM inp_survey
        WHERE member_id = ?
          AND status = ?
    `;

    const params = [member_id, status];

    if (cursor !== null) {
        surveyQuery += ` AND id < ?`;
        params.push(cursor);
    }

    surveyQuery += `
        ORDER BY id DESC
        LIMIT ?
    `;
    params.push(limit + 1);

    const [rows] = await db.query(surveyQuery, params);
    const hasMore = rows.length > limit;
    const surveys = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
        ? surveys[surveys.length - 1].id
        : null;

    return {
        surveys,
        totalCount: Number(countResult.total || 0),
        hasMore,
        nextCursor
    };
};

const getMyActiveSurveys = (member_id, cursor = null, limit = 15) =>
    getMySurveysByStatus(member_id, 1, cursor, limit);

const getMyDraftSurveys = (member_id, cursor = null, limit = 15) =>
    getMySurveysByStatus(member_id, 0, cursor, limit);

const getMyClosedSurveys = (member_id, cursor = null, limit = 15) =>
    getMySurveysByStatus(member_id, 2, cursor, limit);

const getMyDeletedSurveys = (member_id, cursor = null, limit = 15) =>
    getMySurveysByStatus(member_id, 3, cursor, limit);

const getAvailableSurveys = async (member_id) => {

    try {

        // Get User Details
        const userQuery = `
            SELECT
                u.id,
                u.member_id,
                u.gender,
                u.country,
                u.state,
                COALESCE(
                    TIMESTAMPDIFF(YEAR, u.dob, CURDATE()),
                    u.age_entered
                ) AS age,
                up.sector,
                up.industry
            FROM user u
            LEFT JOIN user_profiles up
                ON up.u_id = u.id
            WHERE u.member_id = ?
            LIMIT 1
        `;

        const [[user]] = await db.query(userQuery, [member_id]);

        if (!user) {
            throw new Error("User not found");
        }

        const surveyQuery = `
            SELECT *
            FROM inp_survey
            WHERE
                member_id != ?
                
                -- Active Survey
                AND status = 1

                -- Age Match
                AND (
                    min_age IS NULL
                    OR max_age IS NULL
                    OR ? BETWEEN min_age AND max_age
                )

                -- Gender Match
                AND (
                    gender = 0
                    OR gender = ?
                )

                -- Country Match
                AND (
                    country IS NULL
                    OR country = ''
                    OR country = ?
                )

                -- State Match
                AND (
                    state IS NULL
                    OR state = ''
                    OR state = ?
                )

                -- Sector Match
                AND (
                    sector IS NULL
                    OR sector = ''
                    OR LOWER(TRIM(sector)) = LOWER(TRIM(?))
                )

                -- Industry Match
                AND (
                    industry IS NULL
                    OR industry = ''
                    OR LOWER(TRIM(industry)) = LOWER(TRIM(?))
                )

            ORDER BY id DESC
        `;

        const params = [
            member_id,
            user.age,
            user.gender,
            user.country,
            user.state,
            user.sector,
            user.industry
        ];

        const [surveys] = await db.query(
            surveyQuery,
            params
        );

        return surveys;

    } catch (error) {
        throw error;
    }
};

const getSurveyForMeDetails = async (survey_id, member_id) => {

    const [[survey]] = await db.query(
        `
        SELECT id
        FROM inp_survey
        WHERE id = ?
        LIMIT 1
        `,
        [survey_id]
    );

    if (!survey) {
        return {
            surveyExists: false,
            questions: []
        };
    }

    const [[user]] = await db.query(
        `
        SELECT
            u.gender,
            u.country,
            u.state,
            COALESCE(
                TIMESTAMPDIFF(YEAR, u.dob, CURDATE()),
                u.age_entered
            ) AS age,
            up.sector,
            up.industry
        FROM user u
        LEFT JOIN user_profiles up
            ON up.u_id = u.id
        WHERE u.member_id = ?
        LIMIT 1
        `,
        [member_id]
    );

    if (!user) {
        throw new Error("User not found");
    }

    const [[availableSurvey]] = await db.query(
        `
        SELECT id
        FROM inp_survey
        WHERE
            id = ?
            AND member_id != ?
            AND status = 1
            AND (
                min_age IS NULL
                OR max_age IS NULL
                OR ? BETWEEN min_age AND max_age
            )
            AND (
                gender = 0
                OR gender = ?
            )
            AND (
                country IS NULL
                OR country = ''
                OR country = ?
            )
            AND (
                state IS NULL
                OR state = ''
                OR state = ?
            )
            AND (
                sector IS NULL
                OR sector = ''
                OR LOWER(TRIM(sector)) = LOWER(TRIM(?))
            )
            AND (
                industry IS NULL
                OR industry = ''
                OR LOWER(TRIM(industry)) = LOWER(TRIM(?))
            )
        LIMIT 1
        `,
        [
            survey_id,
            member_id,
            user.age,
            user.gender,
            user.country,
            user.state,
            user.sector,
            user.industry
        ]
    );

    if (!availableSurvey) {
        return {
            surveyExists: true,
            isAvailable: false,
            questions: []
        };
    }

    const [rows] = await db.query(
        `
        SELECT
            q.id AS question_id,
            q.question_text,
            q.question_type,
            q.question_image,
            q.is_required,
            q.question_order,
            o.id AS option_id,
            o.option_text,
            o.option_image,
            o.option_order
        FROM inp_survey_question q
        LEFT JOIN inp_survey_question_option o
            ON o.question_id = q.id
        WHERE q.survey_id = ?
        ORDER BY
            q.question_order ASC,
            o.option_order ASC
        `,
        [survey_id]
    );

    const questionMap = new Map();

    for (const row of rows) {

        if (!questionMap.has(row.question_id)) {
            questionMap.set(row.question_id, {
                question_id: row.question_id,
                question_text: row.question_text,
                question_type: row.question_type,
                question_image: row.question_image,
                is_required: Boolean(row.is_required),
                question_order: row.question_order,
                options: []
            });
        }

        if (row.option_id !== null) {
            questionMap
                .get(row.question_id)
                .options.push({
                    option_id: row.option_id,
                    option_text: row.option_text,
                    option_image: row.option_image,
                    option_order: row.option_order
                });
        }
    }

    return {
        surveyExists: true,
        isAvailable: true,
        questions: Array.from(
            questionMap.values()
        )
    };
};

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

/**
 * Computes how many questions have been answered by this member so far,
 * and whether every required question now has an answer.
 * Must be called with the SAME connection/transaction used to save the answer.
 */
const getSurveyProgress = async (connection, survey_id, member_id) => {

    const [questionRows] = await connection.query(
        `
        SELECT id, is_required
        FROM inp_survey_question
        WHERE survey_id = ?
        `,
        [survey_id]
    );

    const [answeredRows] = await connection.query(
        `
        SELECT DISTINCT question_id
        FROM inp_survey_response
        WHERE survey_id = ?
            AND member_id = ?
        `,
        [survey_id, member_id]
    );

    const answeredIds = new Set(
        answeredRows.map(row => row.question_id)
    );

    const requiredQuestions = questionRows.filter(
        question => question.is_required
    );

    const isCompleted = requiredQuestions.every(
        question => answeredIds.has(question.id)
    );

    return {
        total_questions: questionRows.length,
        answered_questions: answeredIds.size,
        is_completed: isCompleted
    };
};

/**
 * Saves the answer for a single question of a survey.
 * Call this once per question as the user progresses through the form.
 *
 * answerPayload: { answer?: string, option_ids?: number[] }
 */
const submitSurvey = async (
    survey_id,
    member_id,
    question_id,
    answerPayload
) => {

    let connection;

    try {

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[survey]] = await connection.query(
            `
            SELECT id
            FROM inp_survey
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [survey_id]
        );

        if (!survey) {
            throw createError("Survey not found", 404);
        }

        const [[user]] = await connection.query(
            `
            SELECT
                u.gender,
                u.country,
                u.state,
                COALESCE(
                    TIMESTAMPDIFF(YEAR, u.dob, CURDATE()),
                    u.age_entered
                ) AS age,
                up.sector,
                up.industry
            FROM user u
            LEFT JOIN user_profiles up
                ON up.u_id = u.id
            WHERE u.member_id = ?
            LIMIT 1
            `,
            [member_id]
        );

        if (!user) {
            throw createError("User not found", 404);
        }

        const [[availableSurvey]] = await connection.query(
            `
            SELECT id
            FROM inp_survey
            WHERE
                id = ?
                AND member_id != ?
                AND status = 1
                AND (
                    min_age IS NULL
                    OR max_age IS NULL
                    OR ? BETWEEN min_age AND max_age
                )
                AND (
                    gender = 0
                    OR gender = ?
                )
                AND (
                    country IS NULL
                    OR country = ''
                    OR country = ?
                )
                AND (
                    state IS NULL
                    OR state = ''
                    OR state = ?
                )
                AND (
                    sector IS NULL
                    OR sector = ''
                    OR LOWER(TRIM(sector)) = LOWER(TRIM(?))
                )
                AND (
                    industry IS NULL
                    OR industry = ''
                    OR LOWER(TRIM(industry)) = LOWER(TRIM(?))
                )
            LIMIT 1
            `,
            [
                survey_id,
                member_id,
                user.age,
                user.gender,
                user.country,
                user.state,
                user.sector,
                user.industry
            ]
        );

        if (!availableSurvey) {
            throw createError(
                "Survey is not available for this user",
                403
            );
        }

        const [[question]] = await connection.query(
            `
            SELECT
                id AS question_id,
                question_type,
                is_required
            FROM inp_survey_question
            WHERE id = ?
                AND survey_id = ?
            LIMIT 1
            `,
            [question_id, survey_id]
        );

        if (!question) {
            throw createError(
                "Question does not belong to this survey",
                400
            );
        }

        const [optionRows] = await connection.query(
            `
            SELECT id AS option_id
            FROM inp_survey_question_option
            WHERE question_id = ?
            `,
            [question_id]
        );

        const validOptionIds = new Set(
            optionRows.map(row => row.option_id)
        );

        // If this question was already answered by this member, treat this
        // as an update (e.g. user navigated back and changed their answer)
        // rather than rejecting the request outright.
        const [[existingAnswer]] = await connection.query(
            `
            SELECT id
            FROM inp_survey_response
            WHERE survey_id = ?
                AND question_id = ?
                AND member_id = ?
            LIMIT 1
            `,
            [survey_id, question_id, member_id]
        );

        if (existingAnswer) {
            await connection.query(
                `DELETE FROM inp_survey_response_option WHERE response_id = ?`,
                [existingAnswer.id]
            );
            await connection.query(
                `DELETE FROM inp_survey_response WHERE id = ?`,
                [existingAnswer.id]
            );
        }

        const textAnswer =
            typeof answerPayload.answer === "string"
                ? answerPayload.answer.trim()
                : "";

        const rawOptionIds =
            answerPayload.option_ids === undefined
                ? []
                : answerPayload.option_ids;

        if (!Array.isArray(rawOptionIds)) {
            throw createError("option_ids must be an array", 400);
        }

        const optionIds = rawOptionIds.map(Number);

        if (
            optionIds.some(
                optionId =>
                    !Number.isInteger(optionId) ||
                    optionId <= 0
            )
        ) {
            throw createError("Invalid option_id", 400);
        }

        const uniqueOptionIds = [...new Set(optionIds)];

        if (uniqueOptionIds.length !== optionIds.length) {
            throw createError("Duplicate option_id", 400);
        }

        let finalAnswer = null;

        if (question.question_type === "open_end") {

            if (uniqueOptionIds.length > 0) {
                throw createError(
                    "Open-ended question cannot have option_ids",
                    400
                );
            }

            if (!textAnswer) {
                if (question.is_required) {
                    throw createError("Answer is required", 400);
                }
            } else {
                finalAnswer = { answer: textAnswer, optionIds: [] };
            }

        } else {

            // Question types that allow an optional free-text comment
            // alongside their selected option(s), e.g. a "rating" question
            // with an optional "why did you rate it this way" field.
            const commentableTypes = ["rating"];
            const allowsComment = commentableTypes.includes(
                question.question_type
            );

            if (textAnswer && !allowsComment) {
                throw createError(
                    "This question must use option_ids",
                    400
                );
            }

            if (uniqueOptionIds.length === 0) {

                if (question.is_required) {
                    throw createError("An option is required", 400);
                }

                // Optional question skipped for its option, but a
                // commentable type may still carry a standalone comment.
                if (allowsComment && textAnswer) {
                    finalAnswer = { answer: textAnswer, optionIds: [] };
                }

            } else {

                const singleOptionTypes = [
                    "single_select",
                    "dropdown",
                    "rating",
                    "yes_no",
                    "nps"
                ];

                if (
                    singleOptionTypes.includes(
                        question.question_type
                    ) &&
                    uniqueOptionIds.length !== 1
                ) {
                    throw createError(
                        "Only one option is allowed",
                        400
                    );
                }

                for (const optionId of uniqueOptionIds) {
                    if (!validOptionIds.has(optionId)) {
                        throw createError(
                            `Option ${optionId} does not belong to this question`,
                            400
                        );
                    }
                }

                finalAnswer = {
                    answer: allowsComment && textAnswer ? textAnswer : null,
                    optionIds: uniqueOptionIds
                };
            }
        }

        // Optional question with no answer given (e.g. user skipped it) -
        // nothing to persist, just report progress.
        if (finalAnswer === null) {

            const progress = await getSurveyProgress(
                connection,
                survey_id,
                member_id
            );

            await connection.commit();

            return {
                survey_id,
                question_id,
                saved: false,
                ...progress
            };
        }

        const [responseResult] = await connection.query(
            `
            INSERT INTO inp_survey_response
            (survey_id, question_id, member_id, answer)
            VALUES (?, ?, ?, ?)
            `,
            [survey_id, question_id, member_id, finalAnswer.answer]
        );

        for (const optionId of finalAnswer.optionIds) {
            await connection.query(
                `
                INSERT INTO inp_survey_response_option
                (response_id, option_id)
                VALUES (?, ?)
                `,
                [responseResult.insertId, optionId]
            );
        }

        const progress = await getSurveyProgress(
            connection,
            survey_id,
            member_id
        );

        await connection.commit();

        return {
            survey_id,
            question_id,
            saved: true,
            ...progress
        };

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        throw error;

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

const previewSubmittedSurvey = async (
    survey_id,
    member_id
) => {

    let connection;

    try {

        connection = await db.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                q.id AS question_id,
                q.question_text,
                q.question_type,
                q.question_order,
                q.question_image,

                r.answer,

                o.id AS option_id,
                o.option_text

            FROM inp_survey_response r

            INNER JOIN inp_survey_question q
                ON q.id = r.question_id

            LEFT JOIN inp_survey_response_option ro
                ON ro.response_id = r.id

            LEFT JOIN inp_survey_question_option o
                ON o.id = ro.option_id

            WHERE
                r.survey_id = ?
                AND r.member_id = ?

            ORDER BY
                q.question_order,
                o.id
            `,
            [
                survey_id,
                member_id
            ]
        );

        if (!rows.length) {

            const error = new Error(
                "Survey response not found"
            );

            error.statusCode = 404;

            throw error;
        }

        const questions = [];
        const questionMap = new Map();

        for (const row of rows) {

            if (!questionMap.has(row.question_id)) {

                questionMap.set(row.question_id, {
                    question_id: row.question_id,
                    question_text: row.question_text,
                    question_type: row.question_type,
                    question_image: row.question_image,
                    answer: row.answer,
                    selected_options: []
                });

                questions.push(
                    questionMap.get(row.question_id)
                );
            }

            if (row.option_id !== null) {

                questionMap
                    .get(row.question_id)
                    .selected_options.push({
                        option_id: row.option_id,
                        option_text: row.option_text
                    });
            }
        }

        return questions;

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

const deleteSurveyResponse = async (
    response_id,
    member_id
) => {

    let connection;

    const createError = (message, statusCode) => {
        const error = new Error(message);
        error.statusCode = statusCode;
        return error;
    };

    try {

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[response]] = await connection.query(
            `
            SELECT id, survey_id, question_id, member_id
            FROM inp_survey_response
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [response_id]
        );

        if (!response) {
            throw createError("Survey response not found", 404);
        }

        if (Number(response.member_id) !== Number(member_id)) {
            throw createError(
                "Unauthorized access to survey response",
                403
            );
        }

        const [optionResult] = await connection.query(
            `
            DELETE FROM inp_survey_response_option
            WHERE response_id = ?
            `,
            [response_id]
        );

        const [responseResult] = await connection.query(
            `
            DELETE FROM inp_survey_response
            WHERE id = ?
            `,
            [response_id]
        );

        await connection.commit();

        return {
            response_id,
            survey_id: response.survey_id,
            question_id: response.question_id,
            deleted_responses: responseResult.affectedRows,
            deleted_options: optionResult.affectedRows
        };

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        throw error;

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

const getSurveyDetails = async (survey_id, member_id) => {
    try {
        const query = `
            SELECT *
            FROM inp_survey s
            WHERE s.id = ? AND s.member_id = ?
        `;
        const [rows] = await db.query(query, [survey_id, member_id]);
        return rows[0];
    } catch (error) {
        console.error('Error fetching survey details:', error);
        throw error;
    }
};

const getSurveyQuestions = async (survey_id, member_id) => {
    try {

        // Check if the question belong to the survey created by the logged-in user
        const checkQuery = `SELECT member_id FROM inp_survey WHERE id = ?`;

        const [checkRows] = await db.query(checkQuery, [survey_id]);

        if (checkRows.length === 0) {
            throw new Error('Survey not found');
        }

        if(checkRows[0].member_id !== member_id) {
            throw new Error('Unauthorized access to survey questions');
        }

       const [rows] = await db.query(
            `
            SELECT
            q.id AS question_id,
            q.survey_id,
            q.question_text,
            q.question_type,
            q.question_image,
            q.is_required,
            q.question_order,

            o.id AS option_id,
            o.option_text,
            o.option_image,
            o.option_order
            FROM inp_survey_question q
            LEFT JOIN inp_survey_question_option o
                ON q.id = o.question_id
                AND q.survey_id = o.survey_id
            WHERE q.survey_id = ?
            ORDER BY q.question_order ASC, o.option_order ASC
            `,
            [survey_id]
            );

        const questionsMap = {};

        rows.forEach((row) => {
        if (!questionsMap[row.question_id]) {
            questionsMap[row.question_id] = {
            id: row.question_id,
            survey_id: row.survey_id,
            question_text: row.question_text,
            question_type: row.question_type,
            question_image: row.question_image,
            is_required: row.is_required,
            question_order: row.question_order,
            options: []
            };
        }

        if (row.option_id) {
            questionsMap[row.question_id].options.push({
            id: row.option_id,
            option_text: row.option_text,
            option_image: row.option_image,
            option_order: row.option_order
            });
        }
        });

        const questions = Object.values(questionsMap);

        return questions;

        return rows;
    } catch (error) {
        console.error('Error fetching survey questions:', error);
        throw error;
    }
}


/**
 * Fetch top-level Sectors (question_id = 68)
 */
const getSectors = async (question_id) => {
    try {
        const query = `
            SELECT question_answer_id, answer 
            FROM lu_question_answer 
            WHERE question_id = ? 
              AND status = 1
        `;
        const [rows] = await db.query(query, [question_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching sectors:', error);
        throw error;
    }
};

/**
 * Fetch Industries (question_id = 69)
 * Each Industry belongs to a Sector via parent_answer_id
 */
const getIndustries = async (question_id, parent_answer_ids) => {
    try {

        const placeholders = parent_answer_ids
            .map(() => "?")
            .join(",");

        const query = `
            SELECT
                question_answer_id,
                answer,
                parent_answer_id
            FROM lu_question_answer
            WHERE question_id = ?
            AND parent_answer_id IN (${placeholders})
            AND status = 1
            ORDER BY parent_answer_id ASC, answer ASC
        `;

        const [rows] = await db.query(
            query,
            [question_id, ...parent_answer_ids]
        );

        return rows;

    } catch (error) {
        console.error("Error fetching industries:", error);
        throw error;
    }
};

/**
 * Fetch Sub Industries (question_id = 70)
 * Each Sub-Industry belongs to an Industry via parent_answer_id
 */
const getSubIndustries = async (question_id, parent_answer_id) => {
    try {
        const query = `
            SELECT question_answer_id, answer, parent_answer_id
            FROM lu_question_answer 
            WHERE question_id = ? 
              AND parent_answer_id = ? 
              AND status = 1
        `;
        const [rows] = await db.query(query, [question_id, parent_answer_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching sub-industries:', error);
        throw error;
    }
};


// arrow function to get Company Size based on question_id
const getCompanySize = async (question_id) => {
    try {
        const query = "select answer from lu_question_answer where question_id = ?";

        const [rows] = await db.query(query, [question_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching Company Size:', error);
        throw error;
    }
}

// arrow function to get Company Revenue based on question_id
const getCompanyRevenue = async (question_id) => {
    try {
        const query = "select answer from lu_question_answer where question_id = ?";
        const [rows] = await db.query(query, [question_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching Company Revenue:', error);
        throw error;
    }
}

// arrow function to get contrires based on question_id
const getCountries = async () => {
    try {
        const query = "select id,country_name from country";
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('Error fetching country:', error);
        throw error;
    }
}

module.exports = {
    createSurveyDetails,
    updateSurveyDetails,
    saveSurveyQuestions,
    getSurveyPreview,
    publishSurvey,
    closeSurvey,
    archiveSurvey,
    getMySurveys,
    getMyActiveSurveys,
    getMyDraftSurveys,
    getMyClosedSurveys,
    getMyDeletedSurveys,
    getAvailableSurveys,
    getSurveyForMeDetails,
    submitSurvey,
    previewSubmittedSurvey,
    getSectors,
    getIndustries,
    getSubIndustries,
    getCountries,
    getCompanySize,
    getCompanyRevenue,
    getSurveyDetails,
    getSurveyQuestions,
    deleteSurveyResponse};
