const db = require("../config/db");

/**
 * code to fetch all companies
 */
const AllCompanyListing = async (page = 1, limit = 15, filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        // Normalize filters and ensure global_search persists
        let effectiveFilters = { ...filters };
        if (effectiveFilters.global_search && (!effectiveFilters.country || effectiveFilters.country.length === 0)) {
            const searchTerm = effectiveFilters.global_search.trim().toLowerCase();
            // List of known country names (extend as needed based on country table)
            const countries = ['india', 'usa', 'uk', 'canada', 'australia'];
            if (countries.includes(searchTerm)) {
                effectiveFilters.country = [searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)];
            }
        }

        let sql = `
            SELECT 
                c.company_id, 
                c.company_name, 
                c.company_url, 
                DATE_FORMAT(CONVERT_TZ(c.created_on, '+00:00', '+05:30'), '%Y-%m-%d') AS created_on,
                CONCAT(
                    COALESCE(co.country_name, 'Unknown'), ', ',
                    SUBSTRING_INDEX(hq.headquarter_str, ', ', -1)
                ) AS headquarter,
                hq.founded_year,
                hq.company_size,
                hq.industry,
                hq.company_revenue,
                CASE 
                    WHEN hq.company_logo IS NOT NULL 
                    THEN CONCAT('https://beta.caqsmt.com/public/company-logo-images/', hq.company_logo)
                    ELSE NULL
                END AS company_logo_url
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN a.question_id = 40 THEN a.answer END SEPARATOR ', '), ', ', 2) AS headquarter_str,
                    MAX(CASE WHEN a.question_id = 41 THEN a.answer END) AS founded_year,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                    MAX(CASE WHEN a.question_id = 38 THEN a.answer END) AS company_logo
                FROM trx_company_answer a
                WHERE a.question_id IN (38, 40, 41, 42, 43, 46)
                GROUP BY a.company_id
            ) AS hq
                ON hq.company_id = c.company_id
            LEFT JOIN country co
                ON SUBSTRING_INDEX(hq.headquarter_str, ', ', 1) = co.id
            WHERE 1=1
        `;

        const params = [];

        // Global Search (always applied if present)
        if (effectiveFilters.global_search) {
            const search = `%${effectiveFilters.global_search}%`;
            sql += ` AND (
                c.company_name LIKE ? OR
                hq.industry LIKE ? OR
                SUBSTRING_INDEX(hq.headquarter_str, ', ', -1) LIKE ? OR
                co.country_name LIKE ?
            )`;
            params.push(search, search, search, search);
        }

        // Additional Filters
        if (effectiveFilters.company_name && effectiveFilters.company_name.length > 0) {
            const placeholders = effectiveFilters.company_name.map(() => '?').join(',');
            sql += ` AND c.company_name IN (${placeholders})`;
            params.push(...effectiveFilters.company_name.map(v => v.trim()));
        }

        if (effectiveFilters.company_size && effectiveFilters.company_size.length > 0) {
            sql += ` AND (`;
            effectiveFilters.company_size.forEach((size, index) => {
                if (index > 0) sql += ' OR ';
                sql += `REPLACE(REPLACE(LOWER(hq.company_size), ',', ''), ' ', '') = ?`;
                params.push(size.toLowerCase().replace(/,/g, '').replace(/\s/g, ''));
            });
            sql += `)`;
        }

        if (effectiveFilters.company_revenue && effectiveFilters.company_revenue.length > 0) {
            const placeholders = effectiveFilters.company_revenue.map(() => '?').join(',');
            sql += ` AND hq.company_revenue IN (${placeholders})`;
            params.push(...effectiveFilters.company_revenue.map(v => v.trim()));
        }

        if (effectiveFilters.industry && effectiveFilters.industry.length > 0) {
            const placeholders = effectiveFilters.industry.map(() => '?').join(',');
            sql += ` AND hq.industry IN (${placeholders})`;
            params.push(...effectiveFilters.industry.map(v => v.trim()));
        }

        if (effectiveFilters.country && effectiveFilters.country.length > 0) {
            const placeholders = effectiveFilters.country.map(() => '?').join(',');
            sql += ` AND co.country_name IN (${placeholders})`;
            params.push(...effectiveFilters.country.map(v => v.trim()));
        }

        // Pagination
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        // Total Count Query
        let countSql = `
            SELECT COUNT(*) AS total
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                    SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN a.question_id = 40 THEN a.answer END SEPARATOR ', '), ', ', 2) AS headquarter_str
                FROM trx_company_answer a
                WHERE a.question_id IN (40, 42, 43, 46)
                GROUP BY a.company_id
            ) AS hq
            ON hq.company_id = c.company_id
            LEFT JOIN country co
                ON SUBSTRING_INDEX(hq.headquarter_str, ', ', 1) = co.id
            WHERE 1=1
        `;

        const countParams = [];

        // Apply same filters to count query
        if (effectiveFilters.global_search) {
            const search = `%${effectiveFilters.global_search}%`;
            countSql += ` AND (
                c.company_name LIKE ? OR
                hq.industry LIKE ? OR
                SUBSTRING_INDEX(hq.headquarter_str, ', ', -1) LIKE ? OR
                co.country_name LIKE ?
            )`;
            countParams.push(search, search, search, search);
        }

        if (effectiveFilters.company_name && effectiveFilters.company_name.length > 0) {
            const placeholders = effectiveFilters.company_name.map(() => '?').join(',');
            countSql += ` AND c.company_name IN (${placeholders})`;
            countParams.push(...effectiveFilters.company_name.map(v => v.trim()));
        }

        if (effectiveFilters.company_size && effectiveFilters.company_size.length > 0) {
            countSql += ` AND (`;
            effectiveFilters.company_size.forEach((size, index) => {
                if (index > 0) countSql += ' OR ';
                countSql += `REPLACE(REPLACE(LOWER(hq.company_size), ',', ''), ' ', '') = ?`;
                countParams.push(size.toLowerCase().replace(/,/g, '').replace(/\s/g, ''));
            });
            countSql += `)`;
        }

        if (effectiveFilters.company_revenue && effectiveFilters.company_revenue.length > 0) {
            const placeholders = effectiveFilters.company_revenue.map(() => '?').join(',');
            countSql += ` AND hq.company_revenue IN (${placeholders})`;
            countParams.push(...effectiveFilters.company_revenue.map(v => v.trim()));
        }

        if (effectiveFilters.industry && effectiveFilters.industry.length > 0) {
            const placeholders = effectiveFilters.industry.map(() => '?').join(',');
            countSql += ` AND hq.industry IN (${placeholders})`;
            countParams.push(...effectiveFilters.industry.map(v => v.trim()));
        }

        if (effectiveFilters.country && effectiveFilters.country.length > 0) {
            const placeholders = effectiveFilters.country.map(() => '?').join(',');
            countSql += ` AND co.country_name IN (${placeholders})`;
            countParams.push(...effectiveFilters.country.map(v => v.trim()));
        }

        const [countResult] = await db.query(countSql, countParams);
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




/**
 * Fetch company details from trx_company_answer by company_id
 */
const CompanyDetailsById = async (companyId) => {
    try {
        const sql = `
            SELECT 
                a.*,
                q.question_type_header
            FROM trx_company_answer a
            LEFT JOIN lu_question q ON a.question_id = q.question_id
            WHERE a.company_id = ?
        `;
        const [rows] = await db.query(sql, [companyId]);
        return rows;
    } catch (error) {
        throw error;
    }
};

/**
 * Fetch company average ratings by company_id
 */
const CompanyAverageRatings = async (companyId) => {
    try {
        const sql = `
            SELECT 
                company_id,
                ROUND(AVG(employee_satisfaction_rating), 2) AS avg_employee_satisfaction_rating,
                ROUND(AVG(company_culture_rating), 2) AS avg_company_culture_rating,
                ROUND(AVG(easy_of_working_rating), 2) AS avg_easy_of_working_rating,
                ROUND(AVG(work_life_balance_rating), 2) AS avg_work_life_balance_rating,
                ROUND(AVG(top_management_rating), 2) AS avg_top_management_rating,
                ROUND(AVG(hr_attitute_rating), 2) AS avg_hr_attitute_rating,
                ROUND(AVG(ceo_rating), 2) AS avg_ceo_rating,
                COUNT(*) AS total_feedbacks
            FROM inp_employee_feedback
            WHERE company_id = ?
            GROUP BY company_id
        `;
        const [rows] = await db.query(sql, [companyId]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error fetching company average ratings:", error);
        throw error;
    }
};

/**
 * Fetch all company names from trx_company_registration
 */
const getCompanyName = async () => {
    try {
        const sql = `
            SELECT company_id,company_name 
            FROM trx_company_registration
            ORDER BY company_id ASC
        `;
        const [rows] = await db.query(sql);
        return rows;
    } catch (error) {
        throw error;
    }
};

const GlobalCompanySearch = async (page = 1, limit = 15, searchTerm = '') => {
    try {
        const offset = (page - 1) * limit;
        const likeTerm = `%${searchTerm}%`;

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
                hq.company_revenue
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 38 THEN a.answer END) AS company_logo,
                    MAX(CASE WHEN a.question_id = 42 THEN TRIM(a.answer) END) AS company_size,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                    MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                    
                    -- Extract country_id (first value before comma)
                    MAX(CASE 
                        WHEN a.question_id = 40 THEN SUBSTRING_INDEX(a.answer, ',', 1) 
                    END) AS country_id,
                    
                    -- Extract city_name (second value after comma)
                    MAX(CASE 
                        WHEN a.question_id = 40 THEN TRIM(SUBSTRING_INDEX(a.answer, ',', -1)) 
                    END) AS city_name

                FROM trx_company_answer a
                WHERE a.question_id IN (38, 40, 42, 43, 46)
                GROUP BY a.company_id
            ) AS hq ON hq.company_id = c.company_id

            LEFT JOIN country co ON co.id = hq.country_id

            WHERE 
                c.company_name LIKE ?
                OR c.company_url LIKE ?
                OR hq.industry LIKE ?
                OR co.country_name LIKE ?      -- Match country name
                OR hq.city_name LIKE ?         -- Match city name
            ORDER BY c.company_id ASC          -- ✅ Updated order by
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(sql, [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, limit, offset]);

        // Count query
        const countSql = `
            SELECT COUNT(*) AS total
            FROM trx_company_registration c
            LEFT JOIN (
                SELECT 
                    a.company_id,
                    MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,

                    -- Extract country_id and city_name
                    MAX(CASE 
                        WHEN a.question_id = 40 THEN SUBSTRING_INDEX(a.answer, ',', 1) 
                    END) AS country_id,
                    MAX(CASE 
                        WHEN a.question_id = 40 THEN TRIM(SUBSTRING_INDEX(a.answer, ',', -1)) 
                    END) AS city_name

                FROM trx_company_answer a
                WHERE a.question_id IN (40, 43)
                GROUP BY a.company_id
            ) AS hq ON hq.company_id = c.company_id
            LEFT JOIN country co ON co.id = hq.country_id
            WHERE 
                c.company_name LIKE ?
                OR c.company_url LIKE ?
                OR hq.industry LIKE ?
                OR co.country_name LIKE ?
                OR hq.city_name LIKE ?
        `;

        const [countResult] = await db.query(countSql, [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm]);

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



const GlobalUserSearch = async (page = 1, limit = 15, searchTerm = '') => {
    try {
        const offset = (page - 1) * limit;

        const baseSql = `
            FROM user_demographic_details 
            WHERE (
                LOWER(CONCAT_WS(' ', first_name, middle_name, last_name)) LIKE ?
                OR LOWER(country) LIKE ?
                OR LOWER(state) LIKE ?
                OR LOWER(Job_title) LIKE ?
                OR LOWER(sector) LIKE ?
                OR LOWER(industry) LIKE ?
            )
        `;

        const params = Array(6).fill(`%${searchTerm.toLowerCase()}%`);

        // Count query
        const countSql = `SELECT COUNT(*) AS total ${baseSql}`;
        const [countRows] = await db.query(countSql, params);

        const totalRecords = countRows[0].total;

        // Data query
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
            ORDER BY first_name ASC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(dataSql, [...params, limit, offset]);

        return {
            data: rows,
            pagination: {
                total: totalRecords,
                page,
                limit,
                totalPages: Math.ceil(totalRecords / limit)
            }
        };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    CompanyDetailsById,
    AllCompanyListing,
    CompanyAverageRatings,
    getCompanyName,
    GlobalCompanySearch,
    GlobalUserSearch
};
