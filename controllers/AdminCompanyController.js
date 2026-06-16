const CompanyModel = require("../models/adminCompanyModel");

// ====================== GET ALL COMPANIES ======================
const getCompanies = async (req, res) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        // Convert status text → numeric
        let statusValue = "";
        if (req.body.company_status) {
            const status = req.body.company_status.toLowerCase().trim();
            if (status === "verified") statusValue = 1;
            if (status === "pending for verification") statusValue = 2;
        }

        const filters = {
            company_name: req.body.company_name || "",          // comma-separated
            company_url: req.body.company_url || "",
            ceo: req.body.ceo || "",
            headquarter: req.body.headquarter || "",
            company_size: req.body.company_size || "",          // pipe-separated
            company_revenue: req.body.company_revenue || "",    // comma-separated
            industry: req.body.industry || "",                  // comma-separated
            company_status: statusValue || "",
            start_date: req.body.start_date || "",
            end_date: req.body.end_date || ""
        };

        const companies = await CompanyModel.AdminCompanyListing(page, limit, filters);

        if (!companies.data || companies.data.length === 0) {
            return res.status(200).json({
                message: "No companies found",
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                }
            });
        }

        res.status(200).json({
            message: "Companies fetched successfully",
            ...companies
        });

    } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};


// ====================== GET COMPANY DETAILS BY ID ======================
const getCompanyDetailsById = async (req, res) => {
    try {
        const { company_id } = req.body;
        if (!company_id) {
            return res.status(400).json({ message: "Company ID is required" });
        }
        // Fetch company details
        const details = await CompanyModel.AdminCompanyDetailsById(company_id);

        if (!details || details.length === 0) {
            return res.status(404).json({ message: "No details found for this company" });
        }
        // Extract company-level data from the first row
        const companyInfo = {
            company_id: company_id,
            company_name: details[0].company_name,
            legal_name: details[0].legal_name,
            company_url: details[0].company_url,
            ceo: details[0].ceo,
            company_status: details[0].company_status,
            created_on: details[0].created_on,
            company_logo_url: details[0].company_logo_url || null, // ✅ logo path
        };
        // Transform answers
        const answers = details.map(row => ({
            company_answer_id: row.company_answer_id,
            question_id: row.question_id,
            question_type_header: row.question_type_header,
            subquestion_id: row.subquestion_id,
            answer: row.answer,
        }));
        // Final response
        res.status(200).json({
            message: "Company details fetched successfully",
            data: {
                ...companyInfo,
                answers,
            },
        });
    } catch (error) {
        console.error("Error fetching company details:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};

// ====================== CREATE NEW COMPANY ======================
const createCompany = async (req, res) => {
    try {
        const { company_name, legal_name, company_url, ceo, company_status, answers } = req.body;

        if (!company_name || !legal_name || !company_url || !ceo || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ message: "Missing required fields: company_name, legal_name, company_url, ceo, and answers (array) are required" });
        }

        // Validate answers array
        for (const ans of answers) {
            if (!ans.question_id || !ans.answer) {
                return res.status(400).json({ message: "Each answer must have question_id and answer" });
            }
        }

        const companyData = { company_name, legal_name, company_url, ceo, company_status };

        const newCompany = await CompanyModel.AdminCreateCompany(companyData, answers);

        res.status(201).json({
            message: "Company created successfully",
            company_id: newCompany.company_id
        });
    } catch (error) {
        console.error("Error creating company:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};
// Fetch raw and mapped company details by domain
const getMappedCompanyDetailsByDomain = async (req, res) => {
    try {
        const { domain } = req.body;

        // Validate input
        if (!domain) {
            return res.status(400).json({ message: "Domain is required (e.g., 'example.com')" });
        }

        // Basic domain format validation
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ message: "Invalid domain format" });
        }

        // Call model function to fetch and map data
        const result = await CompanyModel.FetchMappedCompanyDetailsByDomain(domain);

        // Return raw API data and mapped company_data
        res.status(200).json({
            message: "Company details fetched successfully",
            data: result.data,
            company_data: result.company_data
        });
    } catch (error) {
        console.error("Error in getMappedCompanyDetailsByDomain:", error);
        res.status(400).json({ message: error.message });
    }
};
module.exports = { getCompanies, getCompanyDetailsById, createCompany,getMappedCompanyDetailsByDomain};
