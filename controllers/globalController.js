const { GlobalCompanySearch, GlobalUserSearch, GlobalSurveySearch } = require('../models/globalModel');

const globalSearchController = async (req, res) => {
    try {
        const searchTerm = req.body.searchTerm
            ? req.body.searchTerm.trim()
            : '';

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        const surveyFilters = {
            sector: Array.isArray(req.body.survey_sector)
                ? req.body.survey_sector
                : (req.body.survey_sector ? req.body.survey_sector.split(',') : []),

            industry: req.body.survey_industry || '',

            country: Array.isArray(req.body.survey_country)
                ? req.body.survey_country
                : (req.body.survey_country ? req.body.survey_country.split(',') : []),

            date_posted: req.body.date_posted || '',
            start_date: req.body.start_date || '',
            end_date: req.body.end_date || ''
        };

        const userFilters = {
            sector: Array.isArray(req.body.people_sector)
                ? req.body.people_sector
                : (req.body.people_sector ? req.body.people_sector.split(',') : []),

            industry: req.body.people_industry || '',
            company_name: Array.isArray(req.body.people_company)
                ? req.body.people_company
                : (req.body.people_company ? req.body.people_company.split(',') : []),

            country: Array.isArray(req.body.people_country)
                ? req.body.people_country
                : (req.body.people_country ? req.body.people_country.split(',') : []),

            job_title: req.body.people_job_title || ''
        };

        const companyFilters = {
            industry: req.body.company_industry || '',
            location: req.body.company_location || '',
            company_size: req.body.company_size || '',
            company_type: req.body.company_type || ''
        };

        // Require at least searchTerm OR one filter
        const hasSearchTerm = searchTerm.length > 0;
        const hasUserFilter = Object.values(userFilters).some(v => v !== '' && v !== undefined);
        const hasCompanyFilter = Object.values(companyFilters).some(v => v !== '' && v !== undefined);
        const hasSurveyFilter = Object.values(surveyFilters).some(v => v !== '' && v !== undefined);

        if (!hasSearchTerm && !hasUserFilter && !hasCompanyFilter && !hasSurveyFilter) {
            return res.status(400).json({
                success: false,
                message: "Please enter a search term or apply at least one filter"
            });
        }

        const [companyResult, userResult, surveyResult] = await Promise.all([
            GlobalCompanySearch(page, limit, searchTerm, companyFilters),
            GlobalUserSearch(page, limit, searchTerm, userFilters),
            GlobalSurveySearch(page, limit, searchTerm, surveyFilters)
        ]);

        const hasCompanies = companyResult.data && companyResult.data.length > 0;
        const hasUsers     = userResult.data && userResult.data.length > 0;
        const hasSurveys   = surveyResult.data && surveyResult.data.length > 0;

        if (!hasCompanies && !hasUsers && !hasSurveys) {
            return res.status(404).json({
                success: false,
                message: "No results found matching your search"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Search results fetched successfully",
            companies: companyResult,
            users: userResult,
            surveys: surveyResult
        });

    } catch (error) {
        console.error("Error in global search:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = { globalSearchController };