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

        if (filters.company_size) {
            conditions.push(`TRIM(hq.company_size) LIKE ?`);
            params.push(`%${filters.company_size.trim()}%`);
        }
        if (filters.industry) {
            conditions.push(`hq.industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }
        if (filters.company_revenue) {
            conditions.push(`hq.company_revenue = ?`);
            params.push(filters.company_revenue);
        }
        if (filters.company_type) {
            conditions.push(`hq.company_type LIKE ?`);
            params.push(`%${filters.company_type}%`);
        }
        if (filters.location) {
            conditions.push(`hq.country_id = ?`);
            params.push(parseInt(filters.location));
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
                CASE
                    WHEN hq.company_logo IS NOT NULL
                    THEN CONCAT('https://beta.caqsmt.com/public/company-logo-images/', hq.company_logo)
                    ELSE NULL
                END AS company_logo_url,
                COALESCE(co.country_name,'Unknown') AS country_name,
                hq.city_name,
                hq.industry,
                hq.company_size,
                hq.company_type
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 38 THEN a.answer END) AS company_logo,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 44 THEN a.answer END) AS company_type,
                    MAX(CASE WHEN a.question_id = 45 THEN a.answer END) AS business_model,
                    MAX(
                    CASE
                    WHEN a.question_id = 40
                    AND a.answer REGEXP '^[0-9]+$'
                    AND CAST(a.answer AS UNSIGNED) BETWEEN 1 AND 250
                    THEN CAST(a.answer AS UNSIGNED)
                    END
                    ) AS country_id,
                    MAX(
                    CASE
                    WHEN a.question_id = 40
                    AND a.answer NOT REGEXP '^[0-9]+$'
                    AND a.answer NOT LIKE '%@%'
                    AND a.answer NOT LIKE '+%'
                    THEN a.answer
                    END
                    ) AS city_name
                FROM trx_company_answer a
                WHERE a.question_id IN (38,40,42,43,44,45)
                GROUP BY a.company_id
            ) hq ON hq.company_id = c.company_id
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
                    MAX(CASE WHEN a.question_id = 44 THEN a.answer END) AS company_type,
                    MAX(CASE WHEN a.question_id = 45 THEN a.answer END) AS business_model,
                    MAX(
                    CASE
                    WHEN a.question_id = 40
                    AND a.answer REGEXP '^[0-9]+$'
                    AND CAST(a.answer AS UNSIGNED) BETWEEN 1 AND 250
                    THEN CAST(a.answer AS UNSIGNED)
                    END
                    ) AS country_id,
                    MAX(
                    CASE
                    WHEN a.question_id = 40
                    AND a.answer NOT REGEXP '^[0-9]+$'
                    AND a.answer NOT LIKE '%@%'
                    AND a.answer NOT LIKE '+%'
                    THEN a.answer
                    END
                    ) AS city_name
                FROM trx_company_answer a
                WHERE a.question_id IN (38, 40, 42, 43, 44, 45, 46)
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

        // Global Search
        if (searchTerm) {
            const likeTerm = `%${searchTerm}%`;

            conditions.push(`(
                u.first_name LIKE ?
                OR u.middle_name LIKE ?
                OR u.last_name LIKE ?
                OR CONCAT(u.first_name,' ',u.last_name) LIKE ?
                OR CONCAT(u.first_name,' ',u.middle_name,' ',u.last_name) LIKE ?
                OR CAST(u.member_id AS CHAR) LIKE ?
            )`);

            params.push(
                likeTerm,
                likeTerm,
                likeTerm,
                likeTerm,
                likeTerm,
                likeTerm
            );
        }

        // Country
        if (filters.country && filters.country.length > 0) {

            const countryConditions = [];

            filters.country.forEach(country => {
                countryConditions.push(`u.country = ?`);
                params.push(country);
            });

            conditions.push(`(${countryConditions.join(' OR ')})`);
        }

        // Company
        if (filters.company_name && filters.company_name.length > 0) {

            const companyConditions = [];

            filters.company_name.forEach(company => {
                companyConditions.push(`(
                    uc.company_name LIKE ?
                    OR uc.other_company LIKE ?
                )`);

                params.push(
                    `%${company}%`,
                    `%${company}%`
                );
            });

            conditions.push(`(${companyConditions.join(' OR ')})`);
        }

        // Job Title
        if (filters.job_title) {
            conditions.push(`up.job_title LIKE ?`);
            params.push(`%${filters.job_title}%`);
        }

        // Industry
        if (filters.sector && filters.sector.length > 0) {

            const sectorConditions = [];

            filters.sector.forEach(sector => {
                sectorConditions.push(`FIND_IN_SET(?, up.sector)`);
                params.push(sector);
            });

            conditions.push(`(${sectorConditions.join(' OR ')})`);
        }

        if (conditions.length === 0) {
            return {
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                }
            };
        }

        const whereClause = conditions.map(c => `(${c})`).join(" AND ");

        // Count Query
        const countSql = `
            SELECT COUNT(DISTINCT u.id) AS total
            FROM user u
            LEFT JOIN user_profiles up ON up.u_id = u.id
            LEFT JOIN country c ON c.id = u.country
            LEFT JOIN user_companies uc ON uc.u_id = u.id
            WHERE ${whereClause}
        `;

        const [countRows] = await db.query(countSql, params);

        // Data Query
        const dataSql = `
            SELECT
                u.id,
                u.member_id,
                u.first_name,
                u.middle_name,
                u.last_name,
                c.country_name AS country,
                u.state,
                u.city,
                up.profile_photo,
                up.job_title,
                COALESCE(uc.company_name, uc.other_company) AS company_name,
                up.sector,
                up.industry
            FROM user u
            LEFT JOIN user_profiles up ON up.u_id = u.id
            LEFT JOIN country c ON c.id = u.country
            LEFT JOIN user_companies uc ON uc.u_id = u.id
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

        // Always exclude draft surveys
        conditions.push(`s.status <> 0`);

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
        if (filters.sector && filters.sector.length > 0) {

            const sectorConditions = filters.sector.map(() => `FIND_IN_SET(?, s.sector)`);

            conditions.push(`(${sectorConditions.join(' OR ')})`);

            params.push(...filters.sector);
        }
        if (filters.industry) {
            conditions.push(`s.industry LIKE ?`);
            params.push(`%${filters.industry}%`);
        }
        if (filters.country && filters.country.length > 0) {

            const countryConditions = filters.country.map(() => `FIND_IN_SET(?, s.country)`);

            conditions.push(`(${countryConditions.join(' OR ')})`);

            params.push(...filters.country);
        }

        // Date Posted
        if (filters.date_posted === '24_hours') {
            conditions.push(`DATE(s.created_on) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`);
        }
        else if (filters.date_posted === '7_days') {
            conditions.push(`DATE(s.created_on) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`);
        }
        else if (filters.date_posted === '28_days') {
            conditions.push(`DATE(s.created_on) >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)`);
        }

        // Custom Date Range
        if (filters.start_date && filters.end_date) {
            conditions.push(`
                DATE(s.start_date) >= ?
                AND DATE(s.end_date) <= ?
            `);

            params.push(filters.start_date, filters.end_date);
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

        // Fetch tags for all surveys
        const surveyIds = rows.map(r => r.id);

        let surveys = rows;

        if (surveyIds.length > 0) {

            const [tags] = await db.query(
                `SELECT survey_id, tag_name
                FROM inp_survey_tags
                WHERE survey_id IN (?)`,
                [surveyIds]
            );

            const tagMap = {};

            tags.forEach(tag => {
                if (!tagMap[tag.survey_id]) {
                    tagMap[tag.survey_id] = [];
                }
                tagMap[tag.survey_id].push(tag.tag_name);
            });

            surveys = rows.map(row => ({
                ...row,
                survey_tags: tagMap[row.id] || []
            }));
        }

        return {
            data: surveys,
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