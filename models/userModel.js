const db = require("../config/db");
const { aesEncrypt } = require("../utils/encryption");
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
    sector,
    industry,
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
                password
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                encryptedPassword
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
                company_name
            )
            VALUES (?, ?)
        `;

        await connection.query(
            companySql,
            [
                userId,
                company_name
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
                industry
            )
            VALUES (?, ?, ?)
        `;

        await connection.query(
            profileSql,
            [
                userId,
                sector,
                industry
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

/*--------------------------------------------------------------
    Membership Request
--------------------------------------------------------------*/
const membershipRequest = async (
    full_name,
    email,
    company_name,
    industry,
    country
) => {

    try {

        const query = `
            INSERT INTO inp_membership_request
            (
                full_name,
                email,
                company_name,
                industry,
                country
            )
            VALUES
            (?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(
            query,
            [
                full_name,
                email,
                company_name,
                industry,
                country
            ]
        );

        return {
            request_id: result.insertId
        };

    } catch (error) {

        throw error;
    }
};

/*--------------------------------------------------------------
    Function to fetch all I&P Users
--------------------------------------------------------------*/
const fetch_users = async (filters, page = 1, limit = 15) => {
    try {
        if (filters instanceof FormData) {
            const obj = {};
            for (let [key, value] of filters.entries()) {
                obj[key] = value;
            }
            filters = obj;
        }
        let baseSql = `FROM user WHERE 1=1`;
        const params = [];
        // Global search across multiple columns
        if (filters.global_search) {
            const searchTerm = `%${filters.global_search.toLowerCase()}%`;
            baseSql += ` AND (
                LOWER(CONCAT_WS(' ', first_name, middle_name, last_name)) LIKE ?
                OR LOWER(country) LIKE ?
                OR LOWER(state) LIKE ?
                OR LOWER(Job_title) LIKE ?
                OR LOWER(sector) LIKE ?
                OR LOWER(industry) LIKE ?
            )`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        if (filters.name) {
            baseSql += ` AND CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?`;
            params.push(`%${filters.name}%`);
        }
        if (filters.Job_title) {
            baseSql += ` AND Job_title LIKE ?`;
            params.push(`%${filters.Job_title}%`);
        }
        // Open-ended location search (matches country OR state)
        if (filters.location) {
            baseSql += ` AND (LOWER(country) LIKE ? OR LOWER(state) LIKE ?)`;
            const loc = `%${filters.location.toLowerCase()}%`;
            params.push(loc, loc);
        }
        if (filters.industry) {
            baseSql += ` AND industry LIKE ?`;
            params.push(`%${filters.industry}%`);
        }
        // Prevent DB query when no filters are applied
        if (params.length === 0) {
            return {
                totalRecords: 0,
                totalPages: 0,
                currentPage: page,
                data: []
            };
        }
        // Count total records
        const countSql = `SELECT COUNT(*) as total ${baseSql}`;
        const [countRows] = await db.query(countSql, params);
        const totalRecords = countRows[0].total;
        const offset = (page - 1) * limit;
        // Fetch paginated data
        const dataSql = `
            SELECT 
                member_id, 
                first_name, 
                middle_name, 
                last_name, 
                country, 
                state,
                Job_title, 
                sector, 
                industry
            ${baseSql}
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];
        const [rows] = await db.query(dataSql, dataParams);
        return {
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            currentPage: page,
            data: rows
        };
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Get user details by member_id
--------------------------------------------------------------*/
const fetch_userDetail = async (member_id) => {
    try {
        const sql = `
            SELECT * 
            FROM user
            WHERE member_id = ?
        `;
        const [rows] = await db.query(sql, [member_id]);
        return rows;
    } catch (error) {
        throw error;
    }
};

/*--------------------------------------------------------------
    Function to Update User's data
--------------------------------------------------------------*/
async function updateUserData(data) {
    const conn = await db.getConnection();

    try {
        if (!data.member_id) throw new Error("member_id is required");

        await conn.beginTransaction();

        // -------------------------------
        // 1. GET USER ID (udd_id)
        // -------------------------------
        const [userRow] = await conn.query(
            "SELECT id FROM user WHERE member_id = ?",
            [data.member_id]
        );

        if (userRow.length === 0) {
            throw new Error("User not found");
        }

        const udd_id = userRow[0].id;

        // -------------------------------
        // 2. UPDATE MAIN TABLE
        // -------------------------------
        const mainFields = [];
        const mainValues = [];

        if (data.name) {
            const parts = data.name.trim().split(/\s+/);

            const first = parts[0] || "";
            const middle = parts.length > 2 ? parts[1] : "";
            const last =
                parts.length === 2
                    ? parts[1]
                    : parts.length > 2
                    ? parts.slice(2).join(" ")
                    : "";

            mainFields.push(
                "first_name = ?",
                "middle_name = ?",
                "last_name = ?"
            );

            mainValues.push(
                aesEncrypt(first),
                aesEncrypt(middle),
                aesEncrypt(last)
            );
        }

        if (data.work_email) {
            mainFields.push("work_email = ?");
            mainValues.push(data.work_email);
        }

        if (data.mobile) {
            mainFields.push("mobile = ?");
            mainValues.push(data.mobile);
        }

        if (data.gender) {
            mainFields.push("gender = ?");
            mainValues.push(data.gender);
        }

        if (data.dob) {
            mainFields.push("dob = ?");
            mainValues.push(data.dob);
        }

        if (data.country) {
            mainFields.push("country = ?");
            mainValues.push(data.country);
        }

        if (data.state) {
            mainFields.push("state = ?");
            mainValues.push(data.state);
        }

        if (data.enter_city) {
            mainFields.push("city = ?");
            mainValues.push(data.enter_city);
        }

        if (data.zip_code) {
            mainFields.push("zip_code = ?");
            mainValues.push(data.zip_code);
        }

        if (data.mailing_address) {
            mainFields.push("mailing_address = ?");
            mainValues.push(data.mailing_address);
        }

        if (mainFields.length > 0) {
            mainValues.push(data.member_id);

            await conn.query(
                `UPDATE user 
                 SET ${mainFields.join(", ")} 
                 WHERE member_id = ?`,
                mainValues
            );
        }

        // -------------------------------
        // 3. META TABLE (INSERT / UPDATE)
        // -------------------------------
        const [meta] = await conn.query(
            "SELECT id FROM user_profiles WHERE udd_id = ?",
            [udd_id]
        );

        if (meta.length === 0) {
            await conn.query(
                `INSERT INTO user_profiles 
                (
                    udd_id,
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
                    sector_industry,
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
                    udd_id,
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
                    data.sector_industry || null,
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
                    sector_industry = ?,
                    department = ?,
                    function = ?,
                    previous_employement = ?,
                    facebook = ?,
                    insta = ?,
                    x = ?,
                    about_user = ?
                 WHERE udd_id = ?`,
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
                    data.sector_industry || null,
                    data.department || null,
                    data.function || null,
                    data.previous_employement || null,
                    data.facebook || null,
                    data.insta || null,
                    data.x || null,
                    data.about_user || null,
                    udd_id
                ]
            );
        }

        // -------------------------------
        // 4. COMPANY TABLE (INSERT / UPDATE)
        // -------------------------------
        const [comp] = await conn.query(
            "SELECT id FROM user_companies WHERE udd_id = ?",
            [udd_id]
        );

        if (comp.length === 0) {
            await conn.query(
                `INSERT INTO user_companies 
                (
                    udd_id,
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
                    udd_id,
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
                 WHERE udd_id = ?`,
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
                    udd_id
                ]
            );
        }

        await conn.commit();

        return { success: true };

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/*--------------------------------------------------------------
    Function to fetch employees by company_id
--------------------------------------------------------------*/
const getEmployeesByCompany = async (company_id) => {
    try {
        if (!company_id) {
            throw new Error("Company ID is required");
        }
        const sql = `
            SELECT 
                id,
                member_id,
                first_name,
                middle_name,
                last_name,
                job_title,
                twitter,
                instagram,
                linkedin,
                about_user
            FROM user 
            WHERE current_company = ? AND current_company IS NOT NULL
            ORDER BY first_name, last_name
        `;
        const [rows] = await db.query(sql, [company_id]);
        return rows;
    } catch (error) {
        console.error("Error fetching employees by company:", error);
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
            SELECT answer 
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
            SELECT answer 
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

const createSignupRequest = async (full_name, email, company_name, industry, country) => {
    try {
        const sql = `
            INSERT INTO signup_request
            (full_name, email, company_name, industry, country, status)
            VALUES (?, ?, ?, ?, ?, 1)
        `; // 1 = pending
        const [result] = await db.query(sql, [full_name, email, company_name, industry, country]);
        return { request_id: result.insertId };
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
    membershipRequest,
    fetch_users,
    fetch_userDetail,
    updateUserData,
    getEmployeesByCompany,
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
    createSignupRequest
    };