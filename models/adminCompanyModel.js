const db = require("../config/db");
const axios = require("axios");

// Fetch all companies from trx_company_registration table
const AdminCompanyListing = async (page = 1, limit = 15, filters = {}) => {
    try {
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let havingConditions = [];
        let params = [];

        // ============================================================
        // ✅ MULTIPLE COMPANY NAME SEARCH (apple, tcs, adidas)
        // ============================================================
        if (filters.company_name) {
            const nameList = filters.company_name
                .split(',')
                .map(n => n.trim())
                .filter(n => n.length > 0);

            if (nameList.length > 0) {
                const placeholders = nameList.map(() => "?").join(",");
                whereConditions.push(`c.company_name IN (${placeholders})`);
                params.push(...nameList);
            }
        }

        // ============================================================
        // TEXT SEARCH FILTERS (single)
        // ============================================================
        if (filters.company_url) {
            whereConditions.push(`c.company_url LIKE ?`);
            params.push(`%${filters.company_url}%`);
        }

        if (filters.ceo) {
            whereConditions.push(`c.ceo LIKE ?`);
            params.push(`%${filters.ceo}%`);
        }

        // ============================================================
        // HEADQUARTER (single)
        // ============================================================
        if (filters.headquarter) {
            havingConditions.push(`
                TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(MAX(CASE WHEN a.question_id = 40 THEN a.answer END), ',', 2), ',', -1)) LIKE ?
            `);
            params.push(`%${filters.headquarter}%`);
        }

        // ============================================================
        // COMPANY STATUS (single)
        // ============================================================
        if (filters.company_status) {
            whereConditions.push(`c.company_status = ?`);
            params.push(filters.company_status);
        }

        // ============================================================
        // DATE RANGE FILTER
        // ============================================================
        if (filters.start_date && filters.end_date) {
            whereConditions.push(`DATE(CONVERT_TZ(c.created_on, '+00:00', '+05:30')) BETWEEN ? AND ?`);
            params.push(filters.start_date, filters.end_date);
        } else if (filters.start_date) {
            whereConditions.push(`DATE(CONVERT_TZ(c.created_on, '+00:00', '+05:30')) >= ?`);
            params.push(filters.start_date);
        } else if (filters.end_date) {
            whereConditions.push(`DATE(CONVERT_TZ(c.created_on, '+00:00', '+05:30')) <= ?`);
            params.push(filters.end_date);
        }

        // ============================================================
        // ✅ MULTIPLE COMPANY SIZE SEARCH (pipe-separated)
        // Example: "Work alone|2-5 employees|6-10 employees"
        // ============================================================
        // COMPANY SIZE (multiple, exact match)
if (filters.company_size) {
    const sizeList = filters.company_size
        .split(';')         // use semicolon for multiple, single value works too
        .map(s => s.trim()) // trim spaces
        .filter(s => s.length > 0);

    if (sizeList.length > 0) {
        const sizeConditions = sizeList
            .map(() => `TRIM(MAX(CASE WHEN a.question_id = 42 THEN a.answer END)) = ?`)
            .join(" OR ");

        havingConditions.push(`(${sizeConditions})`);
        sizeList.forEach(s => params.push(s));
    }
}


        // ============================================================
        // ✅ MULTIPLE COMPANY REVENUE SEARCH (comma-separated)
        // ============================================================
        if (filters.company_revenue) {
            const revenueList = filters.company_revenue
                .split(',')
                .map(r => r.trim())
                .filter(r => r.length > 0);

            if (revenueList.length > 0) {
                const revenueConditions = revenueList
                    .map(() => `MAX(CASE WHEN a.question_id = 46 THEN a.answer END) LIKE ?`)
                    .join(" OR ");

                havingConditions.push(`(${revenueConditions})`);
                revenueList.forEach(r => params.push(`%${r}%`));
            }
        }

        // ============================================================
        // ✅ MULTIPLE INDUSTRY SEARCH (comma-separated)
        // ============================================================
        if (filters.industry) {
            const industryList = filters.industry
                .split(',')
                .map(i => i.trim())
                .filter(i => i.length > 0);

            if (industryList.length > 0) {
                const industryConditions = industryList
                    .map(() => `MAX(CASE WHEN a.question_id = 43 THEN a.answer END) LIKE ?`)
                    .join(" OR ");

                havingConditions.push(`(${industryConditions})`);
                industryList.forEach(i => params.push(`%${i}%`));
            }
        }

        // ============================================================
        // FINAL CLAUSES
        // ============================================================
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
        const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(" AND ")}` : "";

        // ============================================================
        // MAIN QUERY
        // ============================================================
        const sql = `
            SELECT 
                c.company_id, 
                c.company_name, 
                c.legal_name, 
                c.company_url, 
                c.ceo, 
                c.company_status,
                DATE_FORMAT(CONVERT_TZ(c.created_on, '+00:00', '+05:30'), '%Y-%m-%d') AS created_on,
                GROUP_CONCAT(CASE WHEN a.question_id = 40 THEN a.answer END SEPARATOR ', ') AS headquarter,
                MAX(CASE WHEN a.question_id = 42 THEN a.answer END) AS company_size,
                MAX(CASE WHEN a.question_id = 43 THEN a.answer END) AS industry,
                MAX(CASE WHEN a.question_id = 46 THEN a.answer END) AS company_revenue,
                CASE 
                    WHEN MAX(CASE WHEN a.question_id = 38 THEN a.answer END) IS NOT NULL 
                    THEN CONCAT('https://beta.caqsmt.com/public/company-logo-images/', 
                                MAX(CASE WHEN a.question_id = 38 THEN a.answer END))
                    ELSE NULL
                END AS company_logo_url
            FROM trx_company_registration c
            LEFT JOIN trx_company_answer a 
                ON c.company_id = a.company_id
                AND a.question_id IN (40, 42, 43, 46, 38)
            ${whereClause}
            GROUP BY 
                c.company_id, 
                c.company_name, 
                c.legal_name, 
                c.company_url, 
                c.ceo, 
                c.company_status
            ${havingClause}
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        // ============================================================
        // COUNT QUERY
        // ============================================================
        const countSql = `
            SELECT COUNT(*) AS total 
            FROM (
                SELECT c.company_id
                FROM trx_company_registration c
                LEFT JOIN trx_company_answer a 
                    ON c.company_id = a.company_id
                    AND a.question_id IN (40, 42, 43, 46, 38)
                ${whereClause}
                GROUP BY c.company_id
                ${havingClause}
            ) AS subquery
        `;

        const [countResult] = await db.query(countSql, params.slice(0, -2));
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


// Fetch company details from trx_company_answer by company_id
const AdminCompanyDetailsById = async (companyId) => {
    try {
        const sql = `
            SELECT 
                a.company_answer_id,
                a.company_id,
                a.question_id,
                a.subquestion_id,
                a.answer,
                q.question_type_header,
                c.company_name,
                c.legal_name,
                c.company_url,
                c.ceo,
                c.company_status,
                DATE_FORMAT(CONVERT_TZ(c.created_on, '+00:00', '+05:30'), '%Y-%m-%d') AS created_on,
                
                -- ✅ Fetch company logo with a correlated subquery
                (
                    SELECT CONCAT('https://beta.caqsmt.com/public/company-logo-images/', ca.answer)
                    FROM trx_company_answer ca
                    WHERE ca.company_id = c.company_id
                    AND ca.question_id = 38
                    LIMIT 1
                ) AS company_logo_url

            FROM trx_company_registration c
            LEFT JOIN trx_company_answer a 
                ON c.company_id = a.company_id
            LEFT JOIN lu_question q 
                ON a.question_id = q.question_id
            WHERE c.company_id = ?
        `;
        const [rows] = await db.query(sql, [companyId]);
        return rows;
    } catch (error) {
        throw error;
    }
};

// Create a new company in trx_company_registration and insert answers in trx_company_answer
const AdminCreateCompany = async (companyData, answers) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Insert into trx_company_registration
        const insertCompanySql = `
            INSERT INTO trx_company_registration (company_name, legal_name, company_url, ceo, company_status)
            VALUES (?, ?, ?, ?, ?)
        `;
        const companyValues = [
            companyData.company_name,
            companyData.legal_name,
            companyData.company_url,
            companyData.ceo,
            companyData.company_status || 0
        ];
        const [companyResult] = await connection.query(insertCompanySql, companyValues);
        const company_id = companyResult.insertId;

        // Insert each answer into trx_company_answer
        for (const ans of answers) {
            const insertAnswerSql = `
                INSERT INTO trx_company_answer (company_id, question_id, subquestion_id, answer, status)
                VALUES (?, ?, NULL, ?, 1)
            `;
            await connection.query(insertAnswerSql, [company_id, ans.question_id, ans.answer]);
        }

        await connection.commit();
        return { company_id };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
// Fetch company details by domain from external API and map to company_data
const FetchMappedCompanyDetailsByDomain = async (domain) => {
    try {
        // Construct API URL with the domain
        const apiUrl = `https://goto.onlinesurveybureau.com/getCompanyDetailsByCompanyDomain/${encodeURIComponent(domain)}`;
        const response = await axios.get(apiUrl, { timeout: 15000 }); // 15s timeout
        const apiData = response.data;

        // Map API data to company_data array based on provided mappings
        const companyData = {
            "Publically Known As": apiData.name || "Unknown Company",
            "Legal Name": apiData.legalName || apiData.name || "Unknown Legal Name",
            "Company URL": `https://${apiData.domain}`,
            "Parent company URL": apiData.parent?.domain ? `https://${apiData.parent.domain}` : null,
            "About": apiData.description || "",
            "Logo": apiData.logo ? apiData.logo.split('/').pop() : "", // Extract filename
            "Country": apiData.geo?.country || "",
            "City": apiData.geo?.state || "", // Using state as per your mapping
            "Phone": apiData.site?.phoneNumbers?.[0] || "", // First phone number
            "Email": apiData.site?.emailAddresses?.[0] || "", // First email address
            "Postal Code": apiData.geo?.postalCode || "",
            "Year of establishment": apiData.foundedYear ? apiData.foundedYear.toString() : "",
            "Sector/Industry": apiData.category?.sector || "",
            "Employee Size": apiData.metrics?.employees ? apiData.metrics.employees.toString() : "",
            "Estimated Annual Revenue": apiData.metrics?.estimatedAnnualRevenue || "",
            "Funding Raised": apiData.metrics?.raised || "", // Null in API response
            "LinkedIn URL": apiData.linkedin?.handle ? `https://www.linkedin.com/${apiData.linkedin.handle}` : "",
            "Twitter URL": apiData.twitter?.handle ? `https://twitter.com/${apiData.twitter.handle}` : "",
            "SIC Code": apiData.category?.sicCode || "",
            "NAICS Code": apiData.category?.naicsCode || ""
        };

        return {
            data: apiData, // Raw API response
            company_data: companyData // Mapped data
        };
    } catch (error) {
        throw new Error(`Failed to fetch company details: ${error.message}`);
    }
};
module.exports = {
    AdminCompanyListing,
    AdminCompanyDetailsById,
    AdminCreateCompany,
    FetchMappedCompanyDetailsByDomain
};
