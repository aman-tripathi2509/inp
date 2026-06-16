const db = require("../config/db");// getting the database connection

class autoSuggest{
    static searchKeyValuePairs(data, searchTerm) {
        let results = [];
        data.forEach(obj => {
            Object.entries(obj).forEach(([key, value]) => {
                if (searchTerm && typeof value === 'string' && value.toLowerCase().startsWith(searchTerm.toLowerCase())) {
                    results.push({ [key]: value });
                }
            });
        });
    
        return results;
    }
    static async  CompanyDataSuggest(search) {
        try {
    
            // Pagination calculation
        //     const limit=15;
        //     console.log(page);
        //    const offset = (page - 1) * limit;



        //    const count=`SELECT 
        //       count(*)
        //     FROM trx_company_registration c
        //     JOIN trx_company_answer a ON c.company_id = a.company_id
        //     LIMIT 15 OFFSET ${offset};`;
        //     console.log("output:-"+count);
    
           // const c = await db.query(count);
            //console.log("output:-"+c);
            let whereClauses = [];
            let queryParams = [];
    
            // Applying filters dynamically
           // search = String(search);
            if (search) {
                // whereClauses.push("c.company_name LIKE ?");
                // queryParams.push(`%${filters.company_name}%`);
                console.log("search bar item:- "+search);
                whereClauses.push("(c.company_name LIKE ? )");
                queryParams.push(`${search}%`);
       
            }
            // if (filters.company_name) {
            //     whereClauses.push("(c.company_name LIKE ? OR c.legal_name LIKE ?)");
            //     queryParams.push(`%${filters.company_name}%`, `%${filters.company_name}%`);
            // }

            // Construct WHERE clause
            let whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
            //let whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
            
            const companyData = `
            SELECT 
                c.company_name
            FROM trx_company_registration as c
            ${whereSQL} 
            limit 10;
            `;
            console.log("company details:- "+companyData);
            const [rows] = await db.query(companyData,queryParams);
            // Check if rows exist
            if (!rows || rows.length === 0) {
                return {
                    //success: false,
                    message: "No data found",
                    data: []
                };
            }
    
            return rows;
    
        } catch (error) {
            console.error("Error fetching company data:", error);
            return {
               // success: false,
                message: "Failed to fetch company data",
                error: error.message
            };
        }
    };

     static async UserSuggest (search) {
        try {
    
            // Pagination calculation
        //     const limit=15;
        //     console.log("userdetails page:-"+page);
        //    const offset = (page - 1) * limit;
            let whereClauses = [];
            let queryParams = [];
           // search = String(search).trim();
            if (search) {
                console.log("search bar item:- "+search);
                whereClauses.push("(company_name LIKE ? OR sector_and_industry LIKE ? OR country LIKE ? OR zip_code LIKE ? OR state LIKE ? OR enter_city LIKE ? OR job_title LIKE ? OR first_name LIKE ? OR middle_name LIKE ? OR last_name LIKE ? OR linkedin LIKE ? OR profession_type LIKE ? OR company_url LIKE ? OR seniority_level LIKE ? OR department LIKE ?)");
    
                queryParams.push(`${search}%`, `${search}%`, `${search}%`, `${search}%`, `${search}%`, `${search}%`,`${search}%`, `${search}%`, `${search}%`,
                    `${search}%`,`${search}%`,`${search}%`,`${search}%`,`${search}%`,`${search}%`);
            }
            // Applying filters dynamically
            // if (filters.company_name) {
            //     whereClauses.push("company_name LIKE ?");
            //     queryParams.push(`%${filters.company_name}%`);
            // }
            // if (filters.job_title) {
            //     whereClauses.push("sector_and_industry LIKE ?");
            //     queryParams.push(`%${filters.job_title}%`);
            // }
            // if (filters.location) {
            //     whereClauses.push("(country LIKE ? OR state LIKE ? OR enter_city LIKE ? OR zip_code LIKE ?)");
            //     queryParams.push(`%${filters.location}%`, `%${filters.location}%`, `%${filters.location}%`,`%${filters.location}%`);
            // }
            
            
            // if (filters.industry) {
            //     whereClauses.push("industry = ?");
            //     queryParams.push(filters.industry);
            // }
            // if (filters.industry) {
            //     whereClauses.push("sector_and_industry = ?");
            //     queryParams.push(filters.industry);
            // }
            // if (filters.from_date && filters.to_date) {
            //     whereClauses.push("c.created_on BETWEEN ? AND ?");
            //     queryParams.push(filters.from_date, filters.to_date);
            // }
    
            // search,
            // job_title,
            // location,
            // company_name,
            // industry,
            // employees,
            // revenue
            // Construct WHERE clause
          // Ensure whereSQL is always defined
                let whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
                
                // Define the query with placeholders
                const userData = `
                SELECT 
                    first_name,
                    middle_name,
                    last_name,
                    country,
                    state,
                    enter_city,
                    facebook,
                    linkedin,
                    twitter,
                    instagram,
                    company_name,
                    job_title,
                    department,
                    sector_and_industry
                FROM user_demographic_details
                ${whereSQL}
                limit 10 
                `;
    
                // Add the offset to queryParams
               // queryParams.push(offset);
    //console.log("query  "+ userData);
    
        // Pass the queryParams array to `db.query`
            const [rows] = await db.query(userData,queryParams);
           // console.log("Query Result:", rows);
            // Check if rows exist
            if (!rows || rows.length === 0) {
                return {
                    //success: false,
                    message: "No data found",
                    data: []
                };
            }
           const arr= this.searchKeyValuePairs(rows,search);
            return arr;
    
         }
          catch (error) {
            console.error("Error fetching user data:", error);
            return {
               // success: false,
                message: "Failed to fetch user data",
                error: error.message
            };
         }
    };

 
}

module.exports=autoSuggest;