const db = require("../config/db");

const GlobalCompanySearch = async (page = 1, limit = 15, searchTerm = '', filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];

        // Base search — only if searchTerm provided
        if (searchTerm) {
            const likeTerm = `%${searchTerm}%`;
            conditions.push(`(
                c.company_name LIKE ?
                OR c.company_url LIKE ?
                OR hq.industry LIKE ?
                OR co.country_name LIKE ?
                OR hq.city_name LIKE ?
            )`);
            params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }

        // Filters
        if (filters.company_name) {
            conditions.push(`c.company_name LIKE ?`);
            params.push(`%${filters.company_name}%`);
        }
        if (filters.company_size) {
            conditions.push(`TRIM(hq.company_size) = ?`);
            params.push(filters.company_size);
        }
        if (filters.industry) {
            conditions.push(`hq.industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }
        if (filters.company_revenue) {
            conditions.push(`hq.company_revenue = ?`);
            params.push(filters.company_revenue);
        }
        if (filters.business_model) {
            conditions.push(`hq.business_model = ?`);
            params.push(filters.business_model);
        }
        if (filters.location) {
            conditions.push(`(co.country_name LIKE ? OR hq.city_name LIKE ?)`);
            params.push(`%${filters.location}%`, `%${filters.location}%`);
        }

        // If no conditions at all, return empty
        if (conditions.length === 0) {
            return {
                data: [],
                pagination: { total: 0, page, limit, totalPages: 0 }
            };
        }

        const whereClause = conditions.map(c => `(${c})`).join(' AND ');

        const sql = `
            SELECT 
                c.company_id,
                c.company_name,
                c.company_url,
                DATE_FORMAT(CONVERT_TZ(c.created_on, '+00:00', '+05:30'), '%Y-%m-%d') AS created_on,
                CASE 
                    WHEN hq.company_logo IS NOT NULL 
                    THEN CONCAT('https://beta.caqsmt.com/public/company-logo-images/', hq.company_logo)
                    ELSE NULL
                END AS company_logo_url,
                COALESCE(co.country_name, 'Unknown') AS country_name,
                hq.city_name,
                hq.industry,
                hq.company_size,
                hq.company_revenue,
                hq.business_model
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 38 THEN a.answer END) AS company_logo,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                    MAX(CASE WHEN a.question_id = 45 THEN a.answer END) AS business_model,
                    MAX(CASE WHEN a.question_id = 40 THEN SUBSTRING_INDEX(a.answer, ',', 1) END) AS country_id,
                    MAX(CASE WHEN a.question_id = 40 THEN TRIM(SUBSTRING_INDEX(a.answer, ',', -1)) END) AS city_name
                FROM trx_company_answer a
                WHERE a.question_id IN (38, 40, 42, 43, 45, 46)
                GROUP BY a.company_id
            ) AS hq ON hq.company_id = c.company_id
            LEFT JOIN country co ON co.id = hq.country_id
            WHERE ${whereClause}
            ORDER BY c.company_id ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(sql, [...params, limit, offset]);

        const countSql = `
            SELECT COUNT(*) AS total
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                    MAX(CASE WHEN a.question_id = 45 THEN a.answer END) AS business_model,
                    MAX(CASE WHEN a.question_id = 40 THEN SUBSTRING_INDEX(a.answer, ',', 1) END) AS country_id,
                    MAX(CASE WHEN a.question_id = 40 THEN TRIM(SUBSTRING_INDEX(a.answer, ',', -1)) END) AS city_name
                FROM trx_company_answer a
                WHERE a.question_id IN (40, 42, 43, 45, 46)
                GROUP BY a.company_id
            ) AS hq ON hq.company_id = c.company_id
            LEFT JOIN country co ON co.id = hq.country_id
            WHERE ${whereClause}
        `;

        const [countResult] = await db.query(countSql, params);

        return {
            data: rows,
            pagination: {
                total: countResult[0].total,
                page,
                limit,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    } catch (error) {
        throw error;
    }
};

const GlobalUserSearch = async (page = 1, limit = 15, searchTerm = '', filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];

        // Base search
        if (searchTerm) {
            const likeTerm = `%${searchTerm}%`;
            conditions.push(`(
                u.first_name LIKE ?
                OR u.middle_name LIKE ?
                OR u.last_name LIKE ?
                OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
                OR CONCAT(u.first_name, ' ', u.middle_name, ' ', u.last_name) LIKE ?
                OR CAST(u.member_id AS CHAR) LIKE ?
            )`);
            params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }

        // name filter — checks first, middle, last
        if (filters.name) {
            const n = `%${filters.name}%`;
            conditions.push(`(
                u.first_name LIKE ?
                OR u.middle_name LIKE ?
                OR u.last_name LIKE ?
                OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
                OR CONCAT(u.first_name, ' ', u.middle_name, ' ', u.last_name) LIKE ?
            )`);
            params.push(n, n, n, n, n);
        }

        // gender — stored as 0, 1, 2 (tinyint)
        if (filters.gender !== undefined && filters.gender !== '') {
            conditions.push(`u.gender = ?`);
            params.push(parseInt(filters.gender));
        }

        // country — stored as country code (e.g. 102)
        if (filters.country !== undefined && filters.country !== '') {
            conditions.push(`u.country = ?`);
            params.push(filters.country); // send exactly what's stored e.g. "102"
        }

        // location — state and city stored as text
        if (filters.location) {
            const loc = `%${filters.location}%`;
            conditions.push(`(u.state LIKE ? OR u.city LIKE ?)`);
            params.push(loc, loc);
        }

        // user_profiles filters
        if (filters.highest_education) {
            conditions.push(`up.highest_education LIKE ?`);
            params.push(`%${filters.highest_education}%`);
        }
        if (filters.skills) {
            conditions.push(`up.skills LIKE ?`);
            params.push(`%${filters.skills}%`);
        }
        if (filters.profession_type) {
            conditions.push(`up.profession_type = ?`);
            params.push(filters.profession_type);
        }
        if (filters.job_title) {
            conditions.push(`up.job_title LIKE ?`);
            params.push(`%${filters.job_title}%`);
        }
        if (filters.sector) {
            conditions.push(`up.sector LIKE ?`);
            params.push(`%${filters.sector}%`);
        }
        if (filters.industry) {
            conditions.push(`up.industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }

        if (conditions.length === 0) {
            return {
                data: [],
                pagination: { total: 0, page, limit, totalPages: 0 }
            };
        }

        const whereClause = conditions.map(c => `(${c})`).join(' AND ');

        const countSql = `
            SELECT COUNT(*) AS total
            FROM user u
            LEFT JOIN user_profiles up ON up.u_id = u.id
            WHERE ${whereClause}
        `;
        const [countRows] = await db.query(countSql, params);

        const dataSql = `
            SELECT 
                u.id,
                u.member_id,
                u.first_name,
                u.middle_name,
                u.last_name,
                u.gender,
                u.country,
                u.state,
                u.city,
                up.profile_photo,
                up.highest_education,
                up.skills,
                up.profession_type,
                up.job_title,
                up.work_experience,
                up.seniority_level,
                up.sector,
                up.industry,
                up.department,
                up.about_user
            FROM user u
            LEFT JOIN user_profiles up ON up.u_id = u.id
            WHERE ${whereClause}
            ORDER BY u.first_name ASC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(dataSql, [...params, limit, offset]);

        return {
            data: rows,
            pagination: {
                total: countRows[0].total,
                page,
                limit,
                totalPages: Math.ceil(countRows[0].total / limit)
            }
        };
    } catch (error) {
        throw error;
    }
};

const GlobalSurveySearch = async (page = 1, limit = 15, searchTerm = '', filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];

        // Base search — only if searchTerm provided
        if (searchTerm) {
            const likeTerm = `%${searchTerm}%`;
            conditions.push(`(
                s.survey_title LIKE ?
                OR s.survey_description LIKE ?
                OR u.first_name LIKE ?
                OR u.last_name LIKE ?
                OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
            )`);
            params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        }

        if (filters.survey_title) {
            conditions.push(`s.survey_title LIKE ?`);
            params.push(`%${filters.survey_title}%`);
        }
        if (filters.status !== undefined && filters.status !== '') {
            conditions.push(`s.status = ?`);
            params.push(parseInt(filters.status));
        }
        if (filters.gender !== undefined && filters.gender !== '') {
            conditions.push(`s.gender = ?`);
            params.push(parseInt(filters.gender));
        }
        if (filters.sector) {
            conditions.push(`s.sector LIKE ?`);
            params.push(`%${filters.sector}%`);
        }
        if (filters.industry) {
            conditions.push(`s.industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }
        if (filters.country) {
            conditions.push(`s.country LIKE ?`);
            params.push(`%${filters.country}%`);
        }

        if (conditions.length === 0) {
            return {
                data: [],
                pagination: { total: 0, page, limit, totalPages: 0 }
            };
        }

        const whereClause = conditions.map(c => `(${c})`).join(' AND ');

        const countSql = `
            SELECT COUNT(*) AS total
            FROM inp_survey s
            LEFT JOIN user u ON u.member_id = s.member_id
            WHERE ${whereClause}
        `;
        const [countRows] = await db.query(countSql, params);

        const dataSql = `
            SELECT 
                s.*,
                u.first_name AS creator_first_name,
                u.last_name AS creator_last_name
            FROM inp_survey s
            LEFT JOIN user u ON u.member_id = s.member_id
            WHERE ${whereClause}
            ORDER BY s.id DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(dataSql, [...params, limit, offset]);

        return {
            data: rows,
            pagination: {
                total: countRows[0].total,
                page,
                limit,
                totalPages: Math.ceil(countRows[0].total / limit)
            }
        };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    GlobalCompanySearch,
    GlobalUserSearch,
    GlobalSurveySearch
};