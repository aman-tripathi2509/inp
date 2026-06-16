const CompanyModel = require("../models/companyModel");
const { CompanyAverageRatings } = require("../models/companyModel");

// ====================== GET ALL COMPANIES ======================
const { AllCompanyListing } = require("../models/companyModel");
const { GlobalCompanySearch, GlobalUserSearch } = require('../models/companyModel');


const toArray = (value) => {
    if (Array.isArray(value)) return value.map(v => v.trim());
    if (typeof value === 'string') {
        if (value.includes(',')) return value.split(',').map(v => v.trim());
        return [value.trim()];
    }
    return [];
};

const getAllCompanies = async (req, res) => {
    try {
        const filters = {};
        if (req.body.company_name) filters.company_name = toArray(req.body.company_name);
        if (req.body.company_size) filters.company_size = toArray(req.body.company_size).map(v => v.toLowerCase());
        if (req.body.company_revenue) filters.company_revenue = toArray(req.body.company_revenue);
        if (req.body.industry) filters.industry = toArray(req.body.industry);
        if (req.body.country) filters.country = toArray(req.body.country);
        if (req.body.global_search) filters.global_search = req.body.global_search.trim();

        if (
            (!filters.company_name || filters.company_name.length === 0) &&
            (!filters.company_size || filters.company_size.length === 0) &&
            (!filters.company_revenue || filters.company_revenue.length === 0) &&
            (!filters.industry || filters.industry.length === 0) &&
            (!filters.country || filters.country.length === 0) &&
            !filters.global_search
        ) {
            return res.status(400).json({
                message: "Start exploring! Search to discover companies and connections."
            });
        }

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        const companies = await AllCompanyListing(page, limit, filters);

        if (!companies.data || companies.data.length === 0) {
            return res.status(404).json({ message: "No companies found for the given filters" });
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
        const details = await CompanyModel.CompanyDetailsById(company_id);
        if (!details || details.length === 0) {
            return res.status(404).json({ message: "No details found for this company" });
        }
        // Transform response
        const formattedDetails = {
            company_id: company_id,
            answers: details.map(row => ({
                company_answer_id: row.company_answer_id,
                question_id: row.question_id,
                question_type_header: row.question_type_header,
                subquestion_id: row.subquestion_id,
                answer: row.answer,
            }))
        };
        res.status(200).json({
            message: "Company details fetched successfully",
            data: formattedDetails,
        });
    } catch (error) {
        console.error("Error fetching company details:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};

/**
 * Controller to Average Rating of Companies
 */
const getCompanyAverageRatings = async (req, res) => {
    try {
        const { company_id } = req.body;

        if (!company_id) {
            return res.status(400).json({ message: "Company ID is required" });
        }
        // Call model function
        const avgRatings = await CompanyAverageRatings(company_id);
        if (!avgRatings) {
            return res.status(404).json({
                success: false,
                message: "No ratings found for this company",
            });
        }
        // Convert single object to array
        return res.status(200).json({
            success: true,
            data: [avgRatings], // Wrap in array
        });
    } catch (error) {
        console.error("Error in getCompanyAverageRatings:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch company average ratings",
        });
    }
};

/**
 * Controller to fetch all company names
 */
const fetchCompanyNames = async (req, res) => {
    try {
        const data = await CompanyModel.getCompanyName();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No company names found"
            });
        }
        res.status(200).json({
            message: "Company names fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching company names:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

const globalSearchController = async (req, res) => {
    try {
        const searchTerm = req.body.searchTerm ? req.body.searchTerm.trim() : '';

        if (!searchTerm) {
            return res.status(400).json({
                message: "Please enter a search term to find companies or users"
            });
        }

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        // Run both searches in parallel
        const [companyResult, userResult] = await Promise.all([
            GlobalCompanySearch(page, limit, searchTerm),
            GlobalUserSearch(page, limit, searchTerm)
        ]);

        if (
            (!companyResult.data || companyResult.data.length === 0) &&
            (!userResult.data || userResult.data.length === 0)
        ) {
            return res.status(404).json({ message: "No results found matching your search" });
        }

        res.status(200).json({
            message: "Search results fetched successfully",
            companies: companyResult,
            users: userResult
        });
    } catch (error) {
        console.error("Error in global search:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};


module.exports = {getCompanyDetailsById, getAllCompanies,getCompanyAverageRatings,fetchCompanyNames,globalSearchController };
