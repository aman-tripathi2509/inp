const db = require("../config/db");
const { aesEncrypt, aesDecrypt } = require("../utils/encryption");
const crypto = require("crypto");


/*--------------------------------------------------------------
    Generate a random, unique referral code
--------------------------------------------------------------*/
const generateReferralCode = async () => {
    let code;
    let exists = true;

    while (exists) {
        code = crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
        const [rows] = await db.query(
            "SELECT id FROM user WHERE referral_code = ?",
            [code]
        );
        exists = rows.length > 0;
    }

    return code;
};
/*--------------------------------------------------------------
    Function to generate the next member_id
--------------------------------------------------------------*/
const getNextMemberId = async () => {
    try {
        const lastMemberQuery = `
            SELECT member_id 
            FROM user
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

/*--------------------------------------------------------------
    Function to create a new user
--------------------------------------------------------------*/
const createUser = async (
    name,
    email,
    password,

    company_name,
    other_company,

    sector,
    other_sector,

    industry,
    other_industry,

    country,
    other_country,

    referred_by = null
) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const newMemberId = await getNextMemberId();
        const newReferralCode = await generateReferralCode();

        const nameParts = name.trim().split(/\s+/);

        let firstName = '';
        let middleName = '';
        let lastName = '';

        if (nameParts.length === 1) {

            firstName = nameParts[0];

        } else if (nameParts.length === 2) {

            firstName = nameParts[0];
            lastName = nameParts[1];

        } else {

            firstName = nameParts[0];
            middleName = nameParts[1];
            lastName = nameParts.slice(2).join(' ');
        }

        // Encrypt
        const encryptedEmail = aesEncrypt(email);
        const encryptedPassword = aesEncrypt(password);

        /*
        ======================
        INSERT INTO USER
        ======================
        */

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
                    country,
                    other_country
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [userResult] = await connection.query(
            userSql,
            [
                newMemberId,
                newReferralCode,
                referred_by,
                firstName,
                middleName,
                lastName,
                encryptedEmail,
                encryptedPassword,
                country,
                other_country
            ]
        );

        const userId = userResult.insertId;

        /*
        ======================
        INSERT INTO USER_COMPANIES
        ======================
        */

        const companySql = `
            INSERT INTO user_companies
            (
                u_id,
                company_name,
                other_company
            )
            VALUES (?, ?, ?)
        `;

        await connection.query(
            companySql,
            [
                userId,
                company_name,
                other_company
            ]
        );

        /*
        ======================
        INSERT INTO USER_PROFILES
        ======================
        */

        const profileSql = `
            INSERT INTO user_profiles
                (
                    u_id,
                    sector,
                    other_sector,
                    industry,
                    other_industry
                )
                VALUES (?, ?, ?, ?, ?)
        `;

        await connection.query(
            profileSql,
            [
                userId,
                sector,
                other_sector,
                industry,
                other_industry
            ]
        );

        await connection.commit();

        return { ...userResult, member_id: newMemberId, referral_code: newReferralCode };

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();
    }
};

/*--------------------------------------------------------------
    Function to get user by email
--------------------------------------------------------------*/
const getUserByEmail = async (email) => {
    try {
        const sql = "SELECT * FROM user WHERE personal_email = ?";
        const encryptedEmail = aesEncrypt(email);
        const [rows] = await db.query(sql, [encryptedEmail]);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to login with personal_email
--------------------------------------------------------------*/
const loginUser = async (identifier) => {

    try {

        const sql = `
            SELECT 
                id,
                member_id,
                first_name,
                middle_name,
                last_name,
                personal_email,
                password,
                status,
                created_on,
                updated_on
            FROM user
            WHERE personal_email = ?
        `;

        const encryptedIdentifier = aesEncrypt(
            identifier.trim().toLowerCase()
        );

        const [rows] = await db.query(
            sql,
            [encryptedIdentifier]
        );

        return rows;

    } catch (error) {

        throw error;
    }
};

// Get complete user details by member_id
const getLoggedinUser = async (member_id) => {
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
                u.email_verified,
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

                    CASE
                        WHEN uc.u_id IS NOT NULL THEN 1
                        ELSE 0
                    END AS company_details_added,

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

/*--------------------------------------------------------------
    Upload / Update User Profile Photo
--------------------------------------------------------------*/
const updateProfilePhoto = async (member_id, photoPath) => {

    const conn = await db.getConnection();

    try {

        await conn.beginTransaction();

        // Get user ID using member_id
        const [userRows] = await conn.query(
            `SELECT id
             FROM user
             WHERE member_id = ?
             LIMIT 1`,
            [member_id]
        );

        if (userRows.length === 0) {
            throw new Error("User not found");
        }

        const userId = userRows[0].id;

        // Check whether user profile already exists
        const [profileRows] = await conn.query(
            `SELECT id, profile_photo
             FROM user_profiles
             WHERE u_id = ?
             LIMIT 1`,
            [userId]
        );

        let oldPhoto = null;

        if (profileRows.length > 0) {

            // Existing photo
            oldPhoto = profileRows[0].profile_photo;

            // Update photo
            await conn.query(
                `UPDATE user_profiles
                 SET profile_photo = ?
                 WHERE u_id = ?`,
                [
                    photoPath,
                    userId
                ]
            );

        } else {

            // Profile doesn't exist → create it
            await conn.query(
                `INSERT INTO user_profiles
                 (
                     u_id,
                     profile_photo
                 )
                 VALUES (?, ?)`,
                [
                    userId,
                    photoPath
                ]
            );
        }

        await conn.commit();

        return {
            success: true,
            oldPhoto: oldPhoto,
            newPhoto: photoPath
        };

    } catch (error) {

        await conn.rollback();
        throw error;

    } finally {

        conn.release();
    }
};


/*--------------------------------------------------------------
    Function to Update User's data
--------------------------------------------------------------*/
async function updateUserData(member_id, data) {
    const conn = await db.getConnection();

    try {

        if (!member_id) {
            throw new Error("member_id is required");
        }

        await conn.beginTransaction();

        // -------------------------------
        // 1. GET USER ID
        // -------------------------------
        const [userRow] = await conn.query(
            "SELECT id FROM user WHERE member_id = ?",
            [member_id]
        );

        if (userRow.length === 0) {
            throw new Error("User not found");
        }

        const u_id = userRow[0].id;

        // -------------------------------
        // 2. UPDATE MAIN USER TABLE
        // -------------------------------
        const mainFields = [];
        const mainValues = [];

        // First Name
        if (data.first_name !== undefined) {
            mainFields.push("first_name = ?");
            mainValues.push(data.first_name || null);
        }

        // Middle Name
        if (data.middle_name !== undefined) {
            mainFields.push("middle_name = ?");
            mainValues.push(data.middle_name || null);
        }

        // Last Name
        if (data.last_name !== undefined) {
            mainFields.push("last_name = ?");
            mainValues.push(data.last_name || null);
        }

        // Work Email
        if (data.work_email !== undefined) {
            mainFields.push("work_email = ?");
            mainValues.push(
                data.work_email
                    ? aesEncrypt(data.work_email)
                    : null
            );
        }

        // Mobile
        if (data.mobile !== undefined) {
            mainFields.push("mobile = ?");
            mainValues.push(
                data.mobile
                    ? aesEncrypt(data.mobile)
                    : null
            );
        }

        // Gender
        if (data.gender !== undefined) {
            mainFields.push("gender = ?");
            mainValues.push(data.gender || null);
        }

        // DOB
        if (data.dob !== undefined) {
            mainFields.push("dob = ?");
            mainValues.push(data.dob || null);
        }

        // Year of Birth
        if (data.year_of_birth !== undefined) {
            mainFields.push("year_of_birth = ?");
            mainValues.push(data.year_of_birth || null);
        }

        // Age
        if (data.age_entered !== undefined) {
            mainFields.push("age_entered = ?");
            mainValues.push(data.age_entered || null);
        }

        // Country
        if (data.country !== undefined) {
            mainFields.push("country = ?");
            mainValues.push(data.country || null);
        }

        // State
        if (data.state !== undefined) {
            mainFields.push("state = ?");
            mainValues.push(data.state || null);
        }

        // City
        if (data.city !== undefined) {
            mainFields.push("city = ?");
            mainValues.push(data.city || null);
        }

        if (data.zip_code !== undefined) {
            mainFields.push("zip_code = ?");
            mainValues.push(data.zip_code || null);
        }

        // Mailing Address
        if (data.mailing_address !== undefined) {
            mainFields.push("mailing_address = ?");
            mainValues.push(data.mailing_address || null);
        }

        if (mainFields.length > 0) {

            mainValues.push(member_id);

            await conn.query(
                `UPDATE user
                 SET ${mainFields.join(", ")}
                 WHERE member_id = ?`,
                mainValues
            );
        }

        // -------------------------------
        // 3. USER PROFILE
        // -------------------------------

        const [meta] = await conn.query(
            "SELECT id FROM user_profiles WHERE u_id = ?",
            [u_id]
        );

        if (meta.length === 0) {

            await conn.query(
                `INSERT INTO user_profiles
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
                    industry,
                    department,
                    function,
                    previous_employement,
                    facebook,
                    insta,
                    x,
                    about_user
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    u_id,
                    data.profile_photo || null,
                    data.highest_education || null,
                    data.household_income || null,
                    data.skills || null,
                    data.work_status || null,
                    data.employement_status || null,
                    data.profession_type || null,
                    data.job_title || null,
                    data.work_experience || null,
                    data.seniority_level || null,
                    data.job_responsibility || null,
                    data.work_ex_c_company || null,
                    data.sector || null,
                    data.industry || null,
                    data.department || null,
                    data.function || null,
                    data.previous_employement || null,
                    data.facebook || null,
                    data.insta || null,
                    data.x || null,
                    data.about_user || null
                ]
            );

        } else {

            await conn.query(
                `UPDATE user_profiles SET
                    profile_photo = ?,
                    highest_education = ?,
                    household_income = ?,
                    skills = ?,
                    work_status = ?,
                    employement_status = ?,
                    profession_type = ?,
                    job_title = ?,
                    work_experience = ?,
                    seniority_level = ?,
                    job_responsibility = ?,
                    work_ex_c_company = ?,
                    sector = ?,
                    industry = ?,
                    department = ?,
                    function = ?,
                    previous_employement = ?,
                    facebook = ?,
                    insta = ?,
                    x = ?,
                    about_user = ?
                 WHERE u_id = ?`,
                [
                    data.profile_photo || null,
                    data.highest_education || null,
                    data.household_income || null,
                    data.skills || null,
                    data.work_status || null,
                    data.employement_status || null,
                    data.profession_type || null,
                    data.job_title || null,
                    data.work_experience || null,
                    data.seniority_level || null,
                    data.job_responsibility || null,
                    data.work_ex_c_company || null,
                    data.sector || null,
                    data.industry || null,
                    data.department || null,
                    data.function || null,
                    data.previous_employement || null,
                    data.facebook || null,
                    data.insta || null,
                    data.x || null,
                    data.about_user || null,
                    u_id
                ]
            );
        }

        // -------------------------------
        // 4. USER COMPANY
        // -------------------------------

        const [comp] = await conn.query(
            "SELECT id FROM user_companies WHERE u_id = ?",
            [u_id]
        );

        if (comp.length === 0) {

            await conn.query(
                `INSERT INTO user_companies
                (
                    u_id,
                    company_name,
                    company_url,
                    company_revenue,
                    company_type,
                    business_model,
                    company_size,
                    headquarter,
                    company_linkedin,
                    about_company
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    u_id,
                    data.company_name || null,
                    data.company_url || null,
                    data.company_revenue || null,
                    data.company_type || null,
                    data.business_model || null,
                    data.company_size || null,
                    data.headquarter || null,
                    data.company_linkedin || null,
                    data.about_company || null
                ]
            );

        } else {

            await conn.query(
                `UPDATE user_companies SET
                    company_name = ?,
                    company_url = ?,
                    company_revenue = ?,
                    company_type = ?,
                    business_model = ?,
                    company_size = ?,
                    headquarter = ?,
                    company_linkedin = ?,
                    about_company = ?
                 WHERE u_id = ?`,
                [
                    data.company_name || null,
                    data.company_url || null,
                    data.company_revenue || null,
                    data.company_type || null,
                    data.business_model || null,
                    data.company_size || null,
                    data.headquarter || null,
                    data.company_linkedin || null,
                    data.about_company || null,
                    u_id
                ]
            );
        }

        await conn.commit();

        return {
            success: true
        };

    } catch (err) {

        await conn.rollback();
        throw err;

    } finally {

        conn.release();

    }
}


/*--------------------------------------------------------------
    Change Password
--------------------------------------------------------------*/
const changeUserPassword = async (
    member_id,
    current_password,
    new_password
) => {
    try {
        // Get current encrypted password
        const [rows] = await db.query(
            `SELECT id, password
             FROM user
             WHERE member_id = ?
             LIMIT 1`,
            [member_id]
        );

        if (rows.length === 0) {
            return {
                success: false,
                code: "USER_NOT_FOUND"
            };
        }

        const user = rows[0];

        // Decrypt existing password
        let decryptedPassword;

        try {
            decryptedPassword = aesDecrypt(user.password);
        } catch (error) {
            console.error("Password decryption error:", error);

            return {
                success: false,
                code: "PASSWORD_DECRYPT_FAILED"
            };
        }

        // Check current password
        if (current_password !== decryptedPassword) {
            return {
                success: false,
                code: "INVALID_CURRENT_PASSWORD"
            };
        }

        // Prevent using the same password
        if (current_password === new_password) {
            return {
                success: false,
                code: "SAME_PASSWORD"
            };
        }

        // Encrypt new password using existing project method
        const encryptedNewPassword = aesEncrypt(new_password);

        // Update password
        const [result] = await db.query(
            `UPDATE user
             SET password = ?,
                 updated_on = CURRENT_TIMESTAMP
             WHERE member_id = ?`,
            [
                encryptedNewPassword,
                member_id
            ]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                code: "UPDATE_FAILED"
            };
        }

        return {
            success: true
        };

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch highest education
--------------------------------------------------------------*/
const getHighestEducation = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 65
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Work Status
--------------------------------------------------------------*/
const getWorkStatus = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 1
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Profession Type
--------------------------------------------------------------*/
const getProfessionType = async () => {
    try {
        const sql = `
            SELECT question_answer_id,answer 
            FROM lu_question_answer 
            WHERE question_id = 66
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Total Work Ex
--------------------------------------------------------------*/
const getTotalWorkEx = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 3
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Work Ex in current company
--------------------------------------------------------------*/
const getWorkExInCurrentCompany = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 5
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch State by Country ID
--------------------------------------------------------------*/
const getStatesByCountryId = async (countryIds) => {
    try {

        const placeholders = countryIds
            .map(() => "?")
            .join(",");

        const sql = `
            SELECT
                state_id,
                state_name,
                country_id
            FROM trx_state
            WHERE country_id IN (${placeholders})
            ORDER BY country_id ASC, state_name ASC
        `;

        const [rows] = await db.query(
            sql,
            countryIds
        );

        return rows;

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Seniority level
--------------------------------------------------------------*/
const getSeniorityLevel = async () => {
    try {
        const sql = `
            SELECT question_answer_id,answer 
            FROM lu_question_answer 
            WHERE question_id = 59
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch Business Model
--------------------------------------------------------------*/
const getBusinessModel = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 45
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Company Revenue
--------------------------------------------------------------*/
const getCompanyRevenue = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 12
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Company Type
--------------------------------------------------------------*/
const getCompanyType = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 9
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Company Type
--------------------------------------------------------------*/
const getYears = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 41
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Household income
--------------------------------------------------------------*/
const getHouseholdIncome = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 67
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Employement status
--------------------------------------------------------------*/
const getEmployementStatus = async () => {
    try {
        const sql = `
            SELECT answer 
            FROM lu_question_answer 
            WHERE question_id = 2
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to get Department
--------------------------------------------------------------*/
const getDepartment = async () => {
    try {
        const sql = `
            SELECT question_answer_id,answer 
            FROM lu_question_answer 
            WHERE question_id = 71
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------------
    Function to get Functions by Department (using parent_answer_id)
--------------------------------------------------------------------*/
const getFunctionByDepartment = async (departmentId) => {
    try {
        const sql = `
            SELECT question_answer_id, answer 
            FROM lu_question_answer 
            WHERE question_id = 72 
              AND parent_answer_id = ?
            ORDER BY question_answer_id ASC
        `;
        const [rows] = await db.query(sql, [departmentId]);
        return rows;
    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Validate a referral code (must match an existing referral_code)
--------------------------------------------------------------*/
const validateReferral = async (referral_code) => {
    try {
        const sql = `
            SELECT id, member_id, referral_code, first_name, last_name
            FROM user
            WHERE referral_code = ?
            LIMIT 1
        `;
        const [rows] = await db.query(sql, [referral_code]);
        return rows;
    } catch (error) {
        throw error;
    }
};

const createSignupRequest = async (full_name, email, linkedin) => {
    try {
        const sql = `
            INSERT INTO signup_request
            (
                full_name,
                email,
                linkedin
            )
            VALUES (?, ?, ?)
        `;

        const [result] = await db.query(sql, [
            full_name,
            email,
            linkedin
        ]);

        return {
            request_id: result.insertId
        };
    } catch (error) {
        throw error;
    }
};

const getSignupRequestByEmail = async (email) => {
    try {
        const sql = `
            SELECT id, status
            FROM signup_request
            WHERE email = ?
            LIMIT 1
        `;

        const [rows] = await db.query(sql, [email]);

        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Get 2FA Status
--------------------------------------------------------------*/
const getTwoFactorStatus = async (u_id) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id,
                u_id,
                is_enabled,
                auth_method,
                is_verified
             FROM user_two_factor_auth
             WHERE u_id = ?
             LIMIT 1`,
            [u_id]
        );

        if (rows.length === 0) {
            return {
                exists: false,
                is_enabled: false,
                auth_method: null,
                is_verified: false
            };
        }

        return {
            exists: true,
            is_enabled: rows[0].is_enabled === 1,
            auth_method: rows[0].auth_method,
            is_verified: rows[0].is_verified === 1
        };

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Get User 2FA Data
--------------------------------------------------------------*/
const getTwoFactorSecret = async (u_id) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id,
                u_id,
                is_enabled,
                auth_method,
                is_verified,
                secret,
                email_otp,
                otp_expires_at
             FROM user_two_factor_auth
             WHERE u_id = ?
             LIMIT 1`,
            [u_id]
        );

        return rows;

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Create / Get 2FA Secret
--------------------------------------------------------------*/
const createTwoFactorSecret = async (u_id, secret) => {
    try {

        // Check whether user already has a 2FA record
        const [existing] = await db.query(
            `SELECT
                id,
                is_enabled,
                is_verified,
                auth_method,
                secret
             FROM user_two_factor_auth
             WHERE u_id = ?
             LIMIT 1`,
            [u_id]
        );

        // -----------------------------------
        // RECORD ALREADY EXISTS
        // -----------------------------------

        if (existing.length > 0) {

            // If 2FA is already enabled
            if (existing[0].is_enabled === 1) {
                return {
                    success: false,
                    code: "ALREADY_ENABLED"
                };
            }

            // Update existing setup
            await db.query(
                `UPDATE user_two_factor_auth
                 SET
                    secret = ?,
                    auth_method = 'authenticator',
                    is_verified = 0,
                    is_enabled = 0,
                    updated_on = CURRENT_TIMESTAMP
                 WHERE u_id = ?`,
                [secret, u_id]
            );

            return {
                success: true,
                id: existing[0].id
            };
        }

        // -----------------------------------
        // CREATE NEW 2FA RECORD
        // -----------------------------------

        const [result] = await db.query(
            `INSERT INTO user_two_factor_auth
             (
                u_id,
                is_enabled,
                auth_method,
                is_verified,
                secret,
                created_on,
                updated_on
             )
             VALUES (?, 0, 'authenticator', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                u_id,
                secret
            ]
        );

        return {
            success: true,
            id: result.insertId
        };

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Get 2FA Verification Data
--------------------------------------------------------------*/
const verifyTwoFactorOTP = async (u_id) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id,
                u_id,
                is_enabled,
                auth_method,
                is_verified,
                secret,
                email_otp,
                otp_expires_at
             FROM user_two_factor_auth
             WHERE u_id = ?
             LIMIT 1`,
            [u_id]
        );

        if (rows.length === 0) {
            return {
                success: false,
                code: "2FA_NOT_SETUP"
            };
        }

        return {
            success: true,
            data: rows[0]
        };

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Enable 2FA
--------------------------------------------------------------*/
const enableTwoFactor = async (u_id) => {
    try {

        const [result] = await db.query(
            `UPDATE user_two_factor_auth
             SET
                is_enabled = 1,
                is_verified = 1,
                email_otp = NULL,
                otp_expires_at = NULL,
                updated_on = CURRENT_TIMESTAMP
             WHERE u_id = ?`,
            [u_id]
        );

        return result.affectedRows > 0;

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Create / Update Email OTP for 2FA
--------------------------------------------------------------*/
const createEmailTwoFactorOTP = async (
    u_id,
    otpHash,
    otpExpiresAt
) => {
    try {

        // Check existing 2FA record
        const [existing] = await db.query(
            `SELECT id, is_enabled
             FROM user_two_factor_auth
             WHERE u_id = ?
             LIMIT 1`,
            [u_id]
        );

        // -----------------------------------
        // RECORD EXISTS
        // -----------------------------------

        if (existing.length > 0) {

            // Don't allow changing an already enabled 2FA method
            // from this setup API.
            if (existing[0].is_enabled === 1) {
                return {
                    success: false,
                    code: "ALREADY_ENABLED"
                };
            }

            await db.query(
                `UPDATE user_two_factor_auth
                 SET
                    auth_method = 'email',
                    is_verified = 0,
                    is_enabled = 0,
                    secret = NULL,
                    email_otp = ?,
                    otp_expires_at = ?,
                    updated_on = CURRENT_TIMESTAMP
                 WHERE u_id = ?`,
                [
                    otpHash,
                    otpExpiresAt,
                    u_id
                ]
            );

            return {
                success: true,
                id: existing[0].id
            };
        }

        // -----------------------------------
        // CREATE NEW RECORD
        // -----------------------------------

        const [result] = await db.query(
            `INSERT INTO user_two_factor_auth
             (
                u_id,
                is_enabled,
                auth_method,
                is_verified,
                secret,
                email_otp,
                otp_expires_at,
                created_on,
                updated_on
             )
             VALUES (
                ?,
                0,
                'email',
                0,
                NULL,
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
             )`,
            [
                u_id,
                otpHash,
                otpExpiresAt
            ]
        );

        return {
            success: true,
            id: result.insertId
        };

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Clear Email OTP
--------------------------------------------------------------*/
const clearEmailTwoFactorOTP = async (u_id) => {
    try {

        await db.query(
            `UPDATE user_two_factor_auth
             SET
                email_otp = NULL,
                otp_expires_at = NULL,
                updated_on = CURRENT_TIMESTAMP
             WHERE u_id = ?`,
            [u_id]
        );

        return true;

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Create Email OTP for 2FA Login
--------------------------------------------------------------*/
const createEmailLoginOTP = async (
    u_id,
    otpHash,
    otpExpiresAt
) => {
    try {

        const [result] = await db.query(
            `UPDATE user_two_factor_auth
             SET
                email_otp = ?,
                otp_expires_at = ?,
                updated_on = CURRENT_TIMESTAMP
             WHERE u_id = ?
               AND is_enabled = 1
               AND auth_method = 'email'`,
            [
                otpHash,
                otpExpiresAt,
                u_id
            ]
        );

        return {
            success: result.affectedRows > 0
        };

    } catch (error) {
        throw error;
    }
};


/*--------------------------------------------------------------
    Clear Email Login OTP
--------------------------------------------------------------*/
const clearEmailLoginOTP = async (u_id) => {
    try {

        await db.query(
            `UPDATE user_two_factor_auth
             SET
                email_otp = NULL,
                otp_expires_at = NULL,
                updated_on = CURRENT_TIMESTAMP
             WHERE u_id = ?`,
            [u_id]
        );

        return true;

    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Exporting the Functions
--------------------------------------------------------------*/
module.exports = { 
    createUser,
    getUserByEmail,
    loginUser,

    getLoggedinUser,
    updateProfilePhoto,
    updateUserData,
    changeUserPassword,

    getHighestEducation,
    getStatesByCountryId,
    getWorkStatus,
    getProfessionType,
    getTotalWorkEx,
    getSeniorityLevel,
    getWorkExInCurrentCompany,
    getBusinessModel,
    getCompanyRevenue,
    getCompanyType,
    getYears,
    getHouseholdIncome,
    getEmployementStatus,
    getDepartment,
    getFunctionByDepartment,

    validateReferral,
    createSignupRequest,
    getSignupRequestByEmail,

    getTwoFactorStatus,
    getTwoFactorSecret,
    createTwoFactorSecret,
    verifyTwoFactorOTP,
    enableTwoFactor,

    createEmailTwoFactorOTP,
    clearEmailTwoFactorOTP,

    createEmailLoginOTP,
    clearEmailLoginOTP
    };