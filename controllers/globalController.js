const { GlobalCompanySearch, GlobalUserSearch, GlobalSurveySearch } = require('../models/globalModel');

const globalSearchController = async (req, res) => {
    try {
        const searchTerm = req.body.searchTerm
            ? req.body.searchTerm.trim()
            : '';

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        const surveyFilters = {
            survey_title:  req.body.survey_title || '',
            status:        req.body.survey_status ?? '',
            gender:        req.body.survey_gender ?? '',
            sector:        req.body.survey_sector || '',
            industry:      req.body.survey_industry || '',
            country:       req.body.survey_country || ''
        };

        const userFilters = {
            name:              req.body.name || '',
            gender:            req.body.gender ?? '',
            country:           req.body.country || '',
            location:          req.body.location || '',
            highest_education: req.body.highest_education || '',
            skills:            req.body.skills || '',
            profession_type:   req.body.profession_type || '',
            job_title:         req.body.job_title || '',
            sector:            req.body.sector || '',
            industry:          req.body.industry || ''
        };

        const companyFilters = {
            company_name:    req.body.company_name || '',
            company_size:    req.body.company_size || '',
            industry:        req.body.company_industry || '',
            company_revenue: req.body.company_revenue || '',
            business_model:  req.body.business_model || '',
            location:        req.body.company_location || ''
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