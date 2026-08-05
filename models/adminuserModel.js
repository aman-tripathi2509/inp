const db = require("../config/db");


// Admin login model (from lu_user table)
const AdminloginUser = async (username) => {
    try {
        const sql = `
            SELECT
                user_id,
                first_name,
                last_name,
                username,
                password
            FROM lu_user
            WHERE username = ? AND status = 1
        `;
        const [rows] = await db.query(sql, [username]);
        return rows;
    } catch (error) {
        throw error;
    }
};

const AdminINPUserListing = async (page = 1, limit = 15, filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        // -------------------- Filters --------------------

        if (filters.member_id) {
            whereConditions.push(`u.member_id LIKE ?`);
            params.push(`%${filters.member_id}%`);
        }

        if (filters.name) {
            whereConditions.push(`
                CONCAT_WS(
                    ' ',
                    NULLIF(u.first_name, ''),
                    NULLIF(u.middle_name, ''),
                    NULLIF(u.last_name, '')
                ) LIKE ?
            `);
            params.push(`%${filters.name}%`);
        }

        // -------------------- Country --------------------
        if (filters.country.length) {
            whereConditions.push(
                `u.country IN (${filters.country.map(() => "?").join(",")})`
            );
            params.push(...filters.country);
        }

        // -------------------- Current Company --------------------
        if (filters.current_company.length) {
            whereConditions.push(
                `uc.company_name IN (${filters.current_company.map(() => "?").join(",")})`
            );
            params.push(...filters.current_company);
        }

        // -------------------- Job Title --------------------
        if (filters.job_title) {
            whereConditions.push(`up.job_title LIKE ?`);
            params.push(`%${filters.job_title}%`);
        }

        // -------------------- Employee Size --------------------
        if (filters.employee_size.length) {
            whereConditions.push(
                `uc.company_size IN (${filters.employee_size.map(() => "?").join(",")})`
            );
            params.push(...filters.employee_size);
        }

        // -------------------- Company Revenue --------------------
        if (filters.company_revenue.length) {
            whereConditions.push(
                `uc.company_revenue IN (${filters.company_revenue.map(() => "?").join(",")})`
            );
            params.push(...filters.company_revenue);
        }

        // -------------------- Seniority Level --------------------
        if (filters.seniority_level.length) {
            whereConditions.push(
                `up.seniority_level IN (${filters.seniority_level.map(() => "?").join(",")})`
            );
            params.push(...filters.seniority_level);
        }

        // -------------------- Profession Type --------------------
        if (filters.profession_type.length) {
            whereConditions.push(
                `up.profession_type IN (${filters.profession_type.map(() => "?").join(",")})`
            );
            params.push(...filters.profession_type);
        }

        // -------------------- Sector --------------------
        if (filters.sector.length) {
            whereConditions.push(
                `up.sector IN (${filters.sector.map(() => "?").join(",")})`
            );
            params.push(...filters.sector);
        }

        // -------------------- Industry --------------------
        if (filters.industry.length) {
            whereConditions.push(
                `up.industry IN (${filters.industry.map(() => "?").join(",")})`
            );
            params.push(...filters.industry);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

        // -------------------- Main Query --------------------

        const dataSql = `
            SELECT
                u.id AS user_id,
                u.member_id,

                TRIM(
                    CONCAT_WS(
                        ' ',
                        NULLIF(u.first_name, ''),
                        NULLIF(u.middle_name, ''),
                        NULLIF(u.last_name, '')
                    )
                ) AS name,

                c.country_name AS country,

                tcr.company_name AS current_company,

                companySize.answer AS employee_size,

                companyRevenue.answer AS company_revenue,

                up.job_title,

                seniorityLevel.answer AS seniority_level,

                professionType.answer AS profession_type,

                sectorAnswer.answer AS sector,

                industryAnswer.answer AS industry

            FROM user u

            LEFT JOIN user_profiles up
                ON up.u_id = u.id

            LEFT JOIN user_companies uc
                ON uc.u_id = u.id

            LEFT JOIN trx_company_registration tcr
                ON tcr.company_id = CAST(uc.company_name AS UNSIGNED)

            LEFT JOIN country c
                ON c.id = u.country

            LEFT JOIN lu_question_answer companySize
                ON companySize.question_answer_id = CAST(uc.company_size AS UNSIGNED)

            LEFT JOIN lu_question_answer companyRevenue
                ON companyRevenue.question_answer_id = CAST(uc.company_revenue AS UNSIGNED)

            LEFT JOIN lu_question_answer professionType
                ON professionType.question_answer_id = CAST(up.profession_type AS UNSIGNED)

            LEFT JOIN lu_question_answer seniorityLevel
                ON seniorityLevel.question_answer_id = CAST(up.seniority_level AS UNSIGNED)

            LEFT JOIN lu_question_answer sectorAnswer
                ON sectorAnswer.question_answer_id = CAST(up.sector AS UNSIGNED)

            LEFT JOIN lu_question_answer industryAnswer
                ON industryAnswer.question_answer_id = CAST(up.industry AS UNSIGNED)

            ${whereClause}

            ORDER BY u.id DESC

            LIMIT ? OFFSET ?
        `;

        console.log("=========== MODEL ===========");
        console.log("Filters:", filters);
        console.log("Where Conditions:", whereConditions);
        console.log("Where Clause:", whereClause);
        console.log("Params:", params);
        console.log("SQL:", dataSql);

        const [rows] = await db.query(dataSql, [...params, limit, offset]);

        // -------------------- Count Query --------------------

        const countSql = `
            SELECT COUNT(DISTINCT u.id) AS total

            FROM user u

            LEFT JOIN user_profiles up
                ON up.u_id = u.id

            LEFT JOIN user_companies uc
                ON uc.u_id = u.id

            LEFT JOIN trx_company_registration tcr
                ON tcr.company_id = CAST(uc.company_name AS UNSIGNED)

            LEFT JOIN country c
                ON c.id = u.country

            LEFT JOIN lu_question_answer companySize
                ON companySize.question_answer_id = CAST(uc.company_size AS UNSIGNED)

            LEFT JOIN lu_question_answer companyRevenue
                ON companyRevenue.question_answer_id = CAST(uc.company_revenue AS UNSIGNED)

            LEFT JOIN lu_question_answer professionType
                ON professionType.question_answer_id = CAST(up.profession_type AS UNSIGNED)

            LEFT JOIN lu_question_answer seniorityLevel
                ON seniorityLevel.question_answer_id = CAST(up.seniority_level AS UNSIGNED)

            LEFT JOIN lu_question_answer sectorAnswer
                ON sectorAnswer.question_answer_id = CAST(up.sector AS UNSIGNED)

            LEFT JOIN lu_question_answer industryAnswer
                ON industryAnswer.question_answer_id = CAST(up.industry AS UNSIGNED)

            ${whereClause}
        `;

        const [countResult] = await db.query(countSql, params);

        return {
            data: rows,
            pagination: {
                total: countResult[0].total,
                page,
                limit,
                totalPages: Math.ceil(countResult[0].total / limit),
            },
        };

    } catch (error) {
        throw error;
    }
};


// Get complete user details by member_id
const AdminInpUserById = async (member_id) => {
    try {
        const sql = `
            SELECT
                -- ================= USER =================
                u.id,
                u.member_id,
                u.first_name,
                u.middle_name,
                u.last_name,
                u.work_email,
                u.personal_email,
                u.mobile,
                u.dob,
                u.year_of_birth,
                u.age_entered,
                    u.gender,
                    CASE
                    WHEN u.gender = 1 THEN 'Male'
                    WHEN u.gender = 2 THEN 'Female'
                    WHEN u.gender = 3 THEN 'Others'
                    ELSE NULL
                    END AS gender_name,
                u.country,
                c.country_name,
                u.state,
                s.state_name,
                u.city,
                u.zip_code,
                u.mailing_address,
                    u.user_id AS added_by,
                    CONCAT(lu.first_name, ' ', lu.last_name) AS added_by_name,
                u.status,
                DATE_FORMAT(u.created_on, '%d-%m-%Y') AS created_on,

                -- ================= USER PROFILE =================
                up.profile_photo,

                up.highest_education,
                highestEducation.answer AS highest_education_name,

                up.household_income,
                householdIncome.answer AS household_income_name,

                up.skills,

                up.work_status,
                workStatus.answer AS work_status_name,

                up.employement_status,
                employmentStatus.answer AS employement_status_name,

                up.profession_type,
                professionType.answer AS profession_type_name,

                up.job_title,

                up.work_experience,
                workExperience.answer AS work_experience_name,

                up.seniority_level,
                seniorityLevel.answer AS seniority_level_name,

                up.job_responsibility,
                jobResponsibility.answer AS job_responsibility_name,

                up.work_ex_c_company,
                workExCompany.answer AS work_ex_c_company_name,

                up.sector,
                sectorAnswer.answer AS sector_name,

                up.industry,
                industryAnswer.answer AS industry_name,

                up.department,
                departmentAnswer.answer AS department_name,

                up.function,
                functionAnswer.answer AS function_name,

                up.previous_employement,

                up.linkedin,
                up.facebook,
                up.insta,
                up.x,
                up.about_user,

                -- ================= USER COMPANY =================
                uc.company_name,
                tcr.company_name AS current_company_name,

                uc.company_url,

                uc.business_model,
                businessModel.answer AS business_model_name,

                uc.company_revenue,
                companyRevenue.answer AS company_revenue_name,

                uc.company_type,
                companyType.answer AS company_type_name,

                uc.company_size,
                companySize.answer AS company_size_name,

                uc.headquarter,
                uc.company_linkedin,
                uc.about_company

            FROM user u

            LEFT JOIN user_profiles up
                ON up.u_id = u.id

            LEFT JOIN user_companies uc
                ON uc.u_id = u.id

            LEFT JOIN country c
                ON c.id = u.country

            LEFT JOIN trx_state s
                ON s.state_id = u.state

            LEFT JOIN lu_user lu
                ON lu.user_id = u.user_id

            LEFT JOIN trx_company_registration tcr
                ON tcr.company_id = CAST(uc.company_name AS UNSIGNED)

            LEFT JOIN lu_question_answer professionType
                ON professionType.question_answer_id = CAST(up.profession_type AS UNSIGNED)

            LEFT JOIN lu_question_answer seniorityLevel
                ON seniorityLevel.question_answer_id = CAST(up.seniority_level AS UNSIGNED)

            LEFT JOIN lu_question_answer sectorAnswer
                ON sectorAnswer.question_answer_id = CAST(up.sector AS UNSIGNED)

            LEFT JOIN lu_question_answer industryAnswer
                ON industryAnswer.question_answer_id = CAST(up.industry AS UNSIGNED)

            LEFT JOIN lu_question_answer highestEducation
                ON highestEducation.question_answer_id = CAST(up.highest_education AS UNSIGNED)

            LEFT JOIN lu_question_answer householdIncome
                ON householdIncome.question_answer_id = CAST(up.household_income AS UNSIGNED)

            LEFT JOIN lu_question_answer workStatus
                ON workStatus.question_answer_id = CAST(up.work_status AS UNSIGNED)

            LEFT JOIN lu_question_answer employmentStatus
                ON employmentStatus.question_answer_id = CAST(up.employement_status AS UNSIGNED)

            LEFT JOIN lu_question_answer workExperience
                ON workExperience.question_answer_id = CAST(up.work_experience AS UNSIGNED)

            LEFT JOIN lu_question_answer jobResponsibility
                ON jobResponsibility.question_answer_id = CAST(up.job_responsibility AS UNSIGNED)

            LEFT JOIN lu_question_answer workExCompany
                ON workExCompany.question_answer_id = CAST(up.work_ex_c_company AS UNSIGNED)

            LEFT JOIN lu_question_answer departmentAnswer
                ON departmentAnswer.question_answer_id = CAST(up.department AS UNSIGNED)

            LEFT JOIN lu_question_answer functionAnswer
                ON functionAnswer.question_answer_id = CAST(up.function AS UNSIGNED)

            LEFT JOIN lu_question_answer businessModel
                ON businessModel.question_answer_id = CAST(uc.business_model AS UNSIGNED)

            LEFT JOIN lu_question_answer companySize
                ON companySize.question_answer_id = CAST(uc.company_size AS UNSIGNED)

            LEFT JOIN lu_question_answer companyRevenue
                ON companyRevenue.question_answer_id = CAST(uc.company_revenue AS UNSIGNED)

            LEFT JOIN lu_question_answer companyType
                ON companyType.question_answer_id = CAST(uc.company_type AS UNSIGNED)

            WHERE u.member_id = ?

            LIMIT 1
        `;

        const [rows] = await db.query(sql, [member_id]);

        return rows;

    } catch (error) {
        throw error;
    }
};

// Generate next member_id
const getNextMemberId = async () => {
    try {
        const lastMemberQuery = `
            SELECT member_id 
            FROM user_demographic_details
            ORDER BY id DESC 
            LIMIT 1
        `;

        const [rows] = await db.query(lastMemberQuery);

        let newMemberId;
        const currentYear = new Date().getFullYear().toString();
        const fixedPart = '10'; // Fixed part of the ID

        if (rows.length > 0 && rows[0].member_id) {
            let lastMemberId = rows[0].member_id;

            if (typeof lastMemberId !== "string") {
                lastMemberId = lastMemberId.toString();
            }

            const lastSeq = parseInt(lastMemberId.substring(6), 10) || 0;
            const nextSeq = (lastSeq + 1).toString().padStart(3, '0');
            newMemberId = `${currentYear}${fixedPart}${nextSeq}`;
        } else {
            newMemberId = `${currentYear}${fixedPart}001`;
        }

        return newMemberId;
    } catch (error) {
        throw error;
    }
};

// Check if personal_email, work_email, or mobile already exists
const checkUserExists = async (personal_email, work_email, mobile) => {
    try {
        const sql = `
            SELECT member_id, personal_email, work_email, mobile 
            FROM user_demographic_details 
            WHERE personal_email = ? OR work_email = ? OR mobile = ?
            LIMIT 1
        `;
        const [rows] = await db.query(sql, [personal_email, work_email, mobile]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        throw error;
    }
};

// Insert new user (with duplicate check)
const AdminAddInpUser = async (userData) => {
    const connection = await db.getConnection(); // transaction-safe
    try {
        await connection.beginTransaction();

        // ✅ Check if user already exists
        const exists = await checkUserExists(userData.personal_email, userData.work_email, userData.mobile);
        if (exists) {
            let field = exists.personal_email === userData.personal_email
                ? "personal_email"
                : exists.work_email === userData.work_email
                    ? "work_email"
                    : "mobile";

            throw new Error(`User with this ${field} already exists`);
        }

        // Generate unique member_id
        const member_id = await getNextMemberId();

        // Convert previous_employment array to JSON
        const previousEmploymentJSON = JSON.stringify(userData.previous_employment || []);

        // --- 1️⃣ Insert into user_demographic_details ---
        const sql = `
    INSERT INTO user_demographic_details (
        member_id, first_name, middle_name, last_name, personal_email, work_email, mobile, dob, gender,
        zip_code, country, state, enter_city, highest_education, household_income, mailing_address,
        skills, work_status, employement_status, profession_type, Job_title, current_company, company_url,
        Work_experience, seniority_level, job_responsibilities, work_experience_current_company,
        sector_industry, business_model, company_revenue, company_type, employee_size, headquarter,
        company_linkedin_url, specialities, about_product_and_services, about_user,
        linkedin, facebook, twitter, instagram, previous_employment
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;


        const values = [
    member_id,
    userData.first_name,
    userData.middle_name,
    userData.last_name,
    userData.personal_email,
    userData.work_email,
    userData.mobile,
    userData.dob,
    userData.gender,
    userData.zip_code,
    userData.country,
    userData.state,
    userData.enter_city,
    userData.highest_education,
    userData.household_income,
    userData.mailing_address,
    userData.skills,
    userData.work_status,
    userData.employement_status,
    userData.profession_type,
    userData.Job_title,
    userData.current_company,
    userData.company_url,
    userData.Work_experience,
    userData.seniority_level,
    userData.job_responsibilities,
    userData.work_experience_current_company,
    userData.sector_industry,
    userData.business_model,
    userData.company_revenue,
    userData.company_type,
    userData.employee_size,
    userData.headquarter,
    userData.company_linkedin_url,
    userData.specialities,
    userData.about_product_and_services,
    userData.about_user,
    userData.linkedin,
    userData.facebook,
    userData.twitter,
    userData.instagram,
    previousEmploymentJSON
];


        const [result] = await connection.query(sql, values);

        // --- 2️⃣ Insert LinkedIn details into linkedin_data ---
        const sqlLinkedin = `
    INSERT INTO linkedin_data (
        member_id, linkedin_name, linkedin_title, linkedin_company_name, linkedin_location, linkedin_company_url
    ) VALUES (?, ?, ?, ?, ?, ?)
`;

        const valuesLinkedin = [
    member_id,
    userData.linkedin_name,
    userData.linkedin_title,
    userData.linkedin_company_name,
    userData.linkedin_company_location,
    userData.linkedin_company_url
];

        await connection.query(sqlLinkedin, valuesLinkedin);

        // Commit the transaction
        await connection.commit();

        return { insertId: result.insertId, member_id };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};






module.exports = {
    AdminloginUser,
    AdminINPUserListing,
    AdminInpUserById,
    getNextMemberId,
    AdminAddInpUser,
    checkUserExists
};
