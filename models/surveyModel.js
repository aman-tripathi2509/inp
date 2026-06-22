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
        console.log("User Details:", user);
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
const getIndustries = async (question_id, parent_answer_id) => {
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
        console.error('Error fetching industries:', error);
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

module.exports = {createSurveyDetails,
    updateSurveyDetails,
    saveSurveyQuestions,
    getSurveyPreview,
    publishSurvey,
    closeSurvey,
    archiveSurvey,
    getMySurveys,
    getAvailableSurveys,
    getSurveyForMeDetails,
     getSectors, getIndustries,getSubIndustries, getCountries, getCompanySize, getCompanyRevenue};
