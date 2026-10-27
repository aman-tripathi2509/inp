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
            FROM user
            WHERE member_id IS NOT NULL
            ORDER BY id DESC 
            LIMIT 1
        `;

        const [rows] = await db.query(lastMemberQuery);

        let newMemberId;

        const currentYear = new Date()
            .getFullYear()
            .toString();

        const fixedPart = "10";

        if (rows.length > 0 && rows[0].member_id) {

            let lastMemberId = rows[0].member_id;

            if (typeof lastMemberId !== "string") {
                lastMemberId = lastMemberId.toString();
            }

            const lastSeq =
                parseInt(lastMemberId.substring(6), 10) || 0;

            const nextSeq =
                (lastSeq + 1)
                    .toString()
                    .padStart(3, "0");

            newMemberId =
                `${currentYear}${fixedPart}${nextSeq}`;

        } else {

            newMemberId =
                `${currentYear}${fixedPart}001`;
        }

        return newMemberId;

    } catch (error) {
        throw error;
    }
};


// Check if personal_email, work_email, or mobile already exists
const checkUserExists = async (
    personal_email,
    work_email,
    mobile
) => {
    try {

        const sql = `
            SELECT
                id,
                member_id,
                personal_email,
                work_email,
                mobile
            FROM user
            WHERE personal_email = ?
               OR work_email = ?
               OR mobile = ?
            LIMIT 1
        `;

        const [rows] = await db.query(
            sql,
            [
                personal_email,
                work_email,
                mobile
            ]
        );

        return rows.length > 0
            ? rows[0]
            : null;

    } catch (error) {
        throw error;
    }
};

// ====================== ADD INP USER ======================
const AdminAddInpUser = async (userData) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();


        // =====================================================
        // 1. CHECK DUPLICATE USER
        // =====================================================

        const exists = await checkUserExists(
            userData.personal_email,
            userData.work_email,
            userData.mobile
        );

        if (exists) {

            let duplicateField = "email or mobile";

            if (
                userData.work_email &&
                exists.work_email === userData.work_email
            ) {
                duplicateField = "work_email";
            }
            else if (
                userData.personal_email &&
                exists.personal_email === userData.personal_email
            ) {
                duplicateField = "personal_email";
            }
            else if (
                userData.mobile &&
                exists.mobile === userData.mobile
            ) {
                duplicateField = "mobile";
            }

            throw new Error(
                `User with this ${duplicateField} already exists`
            );
        }


        // =====================================================
        // 2. GENERATE MEMBER ID
        // =====================================================

        const member_id = await getNextMemberId();


        // =====================================================
        // 3. INSERT INTO USER TABLE
        // =====================================================

        const userSql = `
            INSERT INTO user
            (
                member_id,
                referral_code,
                referred_by,

                first_name,
                middle_name,
                last_name,

                personal_email,
                password,
                work_email,
                mobile,

                dob,
                year_of_birth,
                age_entered,
                gender,

                zip_code,
                country,
                other_country,
                state,
                city,
                mailing_address,

                user_id,
                status,
                t_c
            )
            VALUES
            (
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?
            )
        `;


        const userValues = [

            member_id,

            userData.referral_code || null,
            userData.referred_by || null,

            userData.first_name || null,
            userData.middle_name || null,
            userData.last_name || null,

            // encrypted personal email
            userData.personal_email || null,

            userData.password || null,

            userData.work_email || null,

            // encrypted mobile
            userData.mobile || null,

            userData.dob || null,
            userData.year_of_birth || null,
            userData.age_entered || null,
            userData.gender || null,

            userData.zip_code || null,

            // country ID
            userData.country || null,

            userData.other_country || null,

            // state ID
            userData.state || null,

            userData.city || null,
            userData.mailing_address || null,

            // logged-in lu_user.user_id
            userData.user_id,

            userData.status ?? 1,
            userData.t_c ?? 1
        ];


        const [userResult] = await connection.query(
            userSql,
            userValues
        );


        // IMPORTANT:
        // user.id becomes u_id for profile/company
        const u_id = userResult.insertId;


        // =====================================================
        // 4. INSERT INTO USER_PROFILES
        // =====================================================

        const profileSql = `
            INSERT INTO user_profiles
            (
                u_id,
                profile_photo,

                highest_education,
                household_income,
                skills,

                work_status,
                employement_status,
                profession_type,

                job_title,
                work_experience,
                seniority_level,
                job_responsibility,
                work_ex_c_company,

                sector,
                other_sector,

                industry,
                other_industry,

                department,
                function,

                previous_employement,

                linkedin,
                facebook,
                insta,
                x,

                about_user
            )
            VALUES
            (
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?,
                ?,
                ?, ?, ?, ?,
                ?
            )
        `;


        // previous_employement can be string / array / object
        let previousEmployment = null;

        if (userData.previous_employement) {

            previousEmployment =
                typeof userData.previous_employement === "string"
                    ? userData.previous_employement
                    : JSON.stringify(
                        userData.previous_employement
                    );
        }


        const profileValues = [

            // user.id
            u_id,

            userData.profile_photo || null,

            // IDs
            userData.highest_education || null,
            userData.household_income || null,

            userData.skills || null,

            // IDs
            userData.work_status || null,
            userData.employement_status || null,
            userData.profession_type || null,

            userData.job_title || null,

            // IDs
            userData.work_experience || null,
            userData.seniority_level || null,
            userData.job_responsibility || null,
            userData.work_ex_c_company || null,

            // sector ID
            userData.sector || null,

            userData.other_sector || null,

            // industry ID
            userData.industry || null,

            userData.other_industry || null,

            // IDs
            userData.department || null,
            userData.function || null,

            previousEmployment,

            userData.linkedin || null,
            userData.facebook || null,
            userData.insta || null,
            userData.x || null,

            userData.about_user || null
        ];


        await connection.query(
            profileSql,
            profileValues
        );


        // =====================================================
        // 5. INSERT INTO USER_COMPANIES
        // =====================================================

        const companySql = `
            INSERT INTO user_companies
            (
                u_id,

                company_name,
                other_company,
                company_url,

                business_model,
                company_revenue,
                company_type,
                company_size,

                headquarter,
                company_linkedin,
                about_company
            )
            VALUES
            (
                ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?
            )
        `;


        const companyValues = [

            // user.id
            u_id,

            // company ID
            userData.company_name || null,

            userData.other_company || null,
            userData.company_url || null,

            // IDs
            userData.business_model || null,
            userData.company_revenue || null,
            userData.company_type || null,
            userData.company_size || null,

            userData.headquarter || null,
            userData.company_linkedin || null,
            userData.about_company || null
        ];


        await connection.query(
            companySql,
            companyValues
        );


        // =====================================================
        // 6. COMMIT TRANSACTION
        // =====================================================

        await connection.commit();


        return {
            insertId: u_id,
            member_id
        };


    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();
    }
};


// ====================== DYNAMIC UPDATE HELPER ======================
const updateFields = async (
    connection,
    table,
    fields,
    whereColumn,
    whereValue
) => {

    const updates = [];
    const values = [];

    Object.entries(fields).forEach(([column, value]) => {

        // undefined = field was not sent
        // null = intentionally set field to NULL
        if (value !== undefined) {
            updates.push(`${column} = ?`);
            values.push(value);
        }
    });

    // Nothing to update
    if (updates.length === 0) {
        return;
    }

    const sql = `
        UPDATE ${table}
        SET ${updates.join(", ")},
            updated_on = CURRENT_TIMESTAMP
        WHERE ${whereColumn} = ?
    `;

    values.push(whereValue);

    await connection.query(sql, values);
};


// ====================== UPDATE INP USER ======================
const AdminUpdateInpUser = async (userData) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();


        // =====================================================
        // 1. FIND USER
        // =====================================================

        const [existingUser] = await connection.query(
            `
            SELECT
                id,
                member_id
            FROM user
            WHERE member_id = ?
            LIMIT 1
            `,
            [userData.member_id]
        );


        if (existingUser.length === 0) {

            throw new Error("User not found");
        }


        // user.id
        const u_id = existingUser[0].id;


        // =====================================================
        // 2. CHECK DUPLICATE EMAIL / MOBILE
        // EXCLUDE CURRENT USER
        // =====================================================

        const duplicateConditions = [];
        const duplicateValues = [];


        if (userData.personal_email !== undefined) {

            duplicateConditions.push(
                "personal_email = ?"
            );

            duplicateValues.push(
                userData.personal_email
            );
        }


        if (userData.work_email !== undefined) {

            duplicateConditions.push(
                "work_email = ?"
            );

            duplicateValues.push(
                userData.work_email
            );
        }


        if (userData.mobile !== undefined) {

            duplicateConditions.push(
                "mobile = ?"
            );

            duplicateValues.push(
                userData.mobile
            );
        }


        if (duplicateConditions.length > 0) {

            const duplicateSql = `
                SELECT
                    id,
                    member_id,
                    personal_email,
                    work_email,
                    mobile
                FROM user
                WHERE id != ?
                  AND (
                    ${duplicateConditions.join(" OR ")}
                  )
                LIMIT 1
            `;


            const [duplicateUser] =
                await connection.query(
                    duplicateSql,
                    [
                        u_id,
                        ...duplicateValues
                    ]
                );


            if (duplicateUser.length > 0) {

                let duplicateField =
                    "email or mobile";


                if (
                    userData.work_email !== undefined &&
                    duplicateUser[0].work_email ===
                    userData.work_email
                ) {

                    duplicateField = "work_email";
                }

                else if (
                    userData.personal_email !== undefined &&
                    duplicateUser[0].personal_email ===
                    userData.personal_email
                ) {

                    duplicateField =
                        "personal_email";
                }

                else if (
                    userData.mobile !== undefined &&
                    duplicateUser[0].mobile ===
                    userData.mobile
                ) {

                    duplicateField = "mobile";
                }


                throw new Error(
                    `User with this ${duplicateField} already exists`
                );
            }
        }


        // =====================================================
        // 3. UPDATE USER TABLE
        // =====================================================

        const userFields = {

            referral_code: userData.referral_code,
            referred_by: userData.referred_by,

            first_name: userData.first_name,
            middle_name: userData.middle_name,
            last_name: userData.last_name,

            personal_email: userData.personal_email,
            password: userData.password,
            work_email: userData.work_email,
            mobile: userData.mobile,

            dob: userData.dob,
            year_of_birth: userData.year_of_birth,
            age_entered: userData.age_entered,
            gender: userData.gender,

            zip_code: userData.zip_code,

            // IDs
            country: userData.country,
            other_country: userData.other_country,
            state: userData.state,

            city: userData.city,
            mailing_address: userData.mailing_address,

            status: userData.status,
            t_c: userData.t_c
        };


        await updateFields(
            connection,
            "user",
            userFields,
            "id",
            u_id
        );


        // =====================================================
        // 4. UPDATE USER_PROFILES
        // =====================================================

        const profileFields = {

            profile_photo:
                userData.profile_photo,

            // IDs
            highest_education:
                userData.highest_education,

            household_income:
                userData.household_income,

            skills:
                userData.skills,

            work_status:
                userData.work_status,

            employement_status:
                userData.employement_status,

            profession_type:
                userData.profession_type,

            job_title:
                userData.job_title,

            work_experience:
                userData.work_experience,

            seniority_level:
                userData.seniority_level,

            job_responsibility:
                userData.job_responsibility,

            work_ex_c_company:
                userData.work_ex_c_company,

            sector:
                userData.sector,

            other_sector:
                userData.other_sector,

            industry:
                userData.industry,

            other_industry:
                userData.other_industry,

            department:
                userData.department,

            function:
                userData.function,

            linkedin:
                userData.linkedin,

            facebook:
                userData.facebook,

            insta:
                userData.insta,

            x:
                userData.x,

            about_user:
                userData.about_user
        };


        // previous employment needs special handling
        if (
            userData.previous_employement !== undefined
        ) {

            profileFields.previous_employement =
                userData.previous_employement &&
                typeof userData.previous_employement
                    !== "string"

                    ? JSON.stringify(
                        userData.previous_employement
                    )

                    : userData.previous_employement;
        }


        await updateFields(
            connection,
            "user_profiles",
            profileFields,
            "u_id",
            u_id
        );


        // =====================================================
        // 5. UPDATE USER_COMPANIES
        // =====================================================

        const companyFields = {

            company_name:
                userData.company_name,

            other_company:
                userData.other_company,

            company_url:
                userData.company_url,

            business_model:
                userData.business_model,

            company_revenue:
                userData.company_revenue,

            company_type:
                userData.company_type,

            company_size:
                userData.company_size,

            headquarter:
                userData.headquarter,

            company_linkedin:
                userData.company_linkedin,

            about_company:
                userData.about_company
        };


        await updateFields(
            connection,
            "user_companies",
            companyFields,
            "u_id",
            u_id
        );


        // =====================================================
        // 6. COMMIT
        // =====================================================

        await connection.commit();


        return {
            id: u_id,
            member_id: userData.member_id
        };


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
    checkUserExists,
    AdminAddInpUser,
    AdminUpdateInpUser
};
