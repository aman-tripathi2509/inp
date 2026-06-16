const db = require("../config/db");


// Admin login model (from lu_user table)
const AdminloginUser = async (username) => {
    try {
        const sql = `
            SELECT * 
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

        // --- Dynamic filter conditions ---
        if (filters.member_id) {
            whereConditions.push(`member_id LIKE ?`);
            params.push(`%${filters.member_id}%`);
        }
        if (filters.name) {
            whereConditions.push(`CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?`);
            params.push(`%${filters.name}%`);
        }
        if (filters.country) {
            whereConditions.push(`country LIKE ?`);
            params.push(`%${filters.country}%`);
        }
        if (filters.current_company) {
            whereConditions.push(`current_company LIKE ?`);
            params.push(`%${filters.current_company}%`);
        }
        if (filters.job_title) {
            whereConditions.push(`job_title LIKE ?`);
            params.push(`%${filters.job_title}%`);
        }
        if (filters.employee_size) {
            whereConditions.push(`employee_size LIKE ?`);
            params.push(`%${filters.employee_size}%`);
        }
        if (filters.company_revenue) {
            whereConditions.push(`company_revenue LIKE ?`);
            params.push(`%${filters.company_revenue}%`);
        }
        if (filters.seniority_level) {
            whereConditions.push(`seniority_level LIKE ?`);
            params.push(`%${filters.seniority_level}%`);
        }
        if (filters.profession_type) {
            whereConditions.push(`profession_type LIKE ?`);
            params.push(`%${filters.profession_type}%`);
        }
        if (filters.sector) {
            whereConditions.push(`sector LIKE ?`);
            params.push(`%${filters.sector}%`);
        }
        if (filters.industry) {
            whereConditions.push(`industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }

        // --- Construct WHERE clause ---
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

        // --- Main SQL query for data ---
        const dataSql = `
            SELECT 
                member_id,
                first_name,
                middle_name,
                last_name,
                country,
                current_company,
                job_title,
                employee_size,
                company_revenue,
                seniority_level,
                profession_type,
                sector,
                industry,
                user_id
            FROM user_demographic_details
            ${whereClause}
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);
        const [rows] = await db.query(dataSql, params);

        // --- Total count for pagination ---
        const countSql = `
            SELECT COUNT(*) AS total
            FROM user_demographic_details
            ${whereClause}
        `;
        const [countResult] = await db.query(countSql, params.slice(0, -2)); // Remove limit and offset
        const total = countResult[0].total;

        return {
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error) {
        throw error;
    }
};



// Get user details by member_id
const AdminInpUserById = async (member_id) => {
    try {
        const sql = `
            SELECT * 
            FROM user_demographic_details
            WHERE member_id = ?
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
