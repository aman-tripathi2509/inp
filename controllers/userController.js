const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { aesEncrypt, aesDecrypt } = require("../utils/encryption");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");

dotenv.config();
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
    },
});

/*--------------------------------------------------------------
    Login function with user_name or personal_email
--------------------------------------------------------------*/
const login = async (req, res) => {

    try {

        const { useremail, password } = req.body;

        if (!useremail || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        // Find user
        const user = await User.loginUser(useremail);

        // EMAIL NOT FOUND
        if (user.length === 0) {

            return res.status(404).json({
                message: "Email does not exist"
            });
        }

        // Decrypt password
        let decryptedPassword;

        try {

            decryptedPassword = aesDecrypt(
                user[0].password
            );

        } catch (err) {

            console.error("Password decryption error:", err);

            return res.status(500).json({
                message: "Password decryption failed"
            });
        }

        // WRONG PASSWORD
        if (password !== decryptedPassword) {

            return res.status(401).json({
                message: "Incorrect password"
            });
        }

        // Generate token
        const token = jwt.sign(
        {
            userId: user[0].id,
            member_id: user[0].member_id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "12h"
        }
        );

        const filteredUser = {

            id: user[0].id,
            member_id: user[0].member_id,

            first_name: user[0].first_name || "",
            middle_name: user[0].middle_name || "",
            last_name: user[0].last_name || ""
        };

        return res.status(200).json({

            message: "Login successful",
            token,
            user: filteredUser
        });

    } catch (error) {

        console.error("Error in login:", error);

        return res.status(500).json({
            message: "Database error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Update user data for logged-in user
--------------------------------------------------------------*/
const updateUser = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        // Fetch current user data
        const user = await User.getUserById(userId);
        if (!user || user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        // Get update fields from request body
        const {
            name,
            personal_email,
            work_email,
            mobile,
            dob,
            gender,
            zip_code,
            country,
            state,
            enter_city,
            highest_education,
            household_income,
            mailing_address,
            skills,
            work_status,
            employement_status,
            profession_type,
            job_title,
            current_company,
            company_url,
            work_experience,
            seniority_level,
            job_responsibilities,
            work_experience_current_company,
            sector,
            industry,
            business_model,
            company_revenue,
            company_type,
            employee_size,
            headquarter,
            company_linkedin_url,
            specialities,
            about_product_and_services,
            about_user,
            twitter,
            instagram,
            facebook,
            linkedin,
            previous_employment
        } = req.body;
        // Debug: Log the previous_employment field to verify it's received
        console.log("Previous employment received:", previous_employment);
        // Validate personal_email if provided
        if (personal_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(personal_email)) {
                return res.status(400).json({ message: "Invalid personal email format" });
            }
        }
        // Validate previous_employment if provided
        if (previous_employment) {
            if (!Array.isArray(previous_employment)) {
                return res.status(400).json({ message: "Previous employment must be an array" });
            }
            for (const employment of previous_employment) {
                // Validate date fields only if they exist
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (employment.start_date && !dateRegex.test(employment.start_date)) {
                    return res.status(400).json({ message: "Invalid start_date format in previous employment (use YYYY-MM-DD)" });
                }
                if (employment.end_date && !dateRegex.test(employment.end_date)) {
                    return res.status(400).json({ message: "Invalid end_date format in previous employment (use YYYY-MM-DD)" });
                }
            }
        }
        // Handle name splitting
        let updateData = {
            personal_email,
            work_email,
            mobile,
            dob,
            gender,
            zip_code,
            country,
            state,
            enter_city,
            highest_education,
            household_income,
            mailing_address,
            skills,
            work_status,
            employement_status,
            profession_type,
            job_title,
            current_company,
            company_url,
            work_experience,
            seniority_level,
            job_responsibilities,
            work_experience_current_company,
            sector,
            industry,
            business_model,
            company_revenue,
            company_type,
            employee_size,
            headquarter,
            company_linkedin_url,
            specialities,
            about_product_and_services,
            about_user,
            twitter,
            instagram,
            facebook,
            linkedin,
            previous_employment,
            updated_on: new Date() // Set current timestamp
        };
        if (name) {
            const nameParts = name.trim().split(/\s+/);
            if (nameParts.length === 1) {
                updateData.first_name = nameParts[0];
            } else if (nameParts.length === 2) {
                updateData.first_name = nameParts[0];
                updateData.last_name = nameParts[1];
            } else {
                updateData.first_name = nameParts[0];
                updateData.middle_name = nameParts[1];
                updateData.last_name = nameParts.slice(2).join(' ');
            }
        }
        // Remove undefined or null fields
        updateData = Object.fromEntries(
            Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null)
        );
        // Debug: Log updateData to verify previous_employment is included
        console.log("Update data:", updateData);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }
        // Call model to update user
        const result = await User.updateUser(userId, updateData);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found or no changes made" });
        }
        // Fetch updated user data
        const updatedUser = await User.getUserById(userId);
        res.status(200).json({
            message: "User data updated successfully",
            user: updatedUser[0]
        });
    } catch (error) {
        console.error("Error in updateUser:", error);
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token" });
        }
        if (error.message === "No fields provided to update") {
            return res.status(400).json({ message: "No fields provided to update" });
        }
        res.status(500).json({ message: "Database error" });
    }
};

/*--------------------------------------------------------------
    Membership Request Controller
--------------------------------------------------------------*/
const membership_Request = async (
    req,
    res
) => {

    try {

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const {
            full_name,
            email,
            company_name,
            industry,
            country
        } = req.body;

        if (
            !full_name ||
            !email ||
            !company_name ||
            !industry ||
            !country
        ) {

            return res.status(400).json({
                success: false,
                message:
                "All fields are required"
            });
        }

        if (
            !emailRegex.test(email)
        ) {

            return res.status(400).json({
                success: false,
                message:
                "Invalid email format"
            });
        }

        const result =
            await User.membershipRequest(
                full_name,
                email,
                company_name,
                industry,
                country
            );

        /*
        ==========================================
        Send Email To Admin
        ==========================================
        */

        try {

            await transporter.sendMail({

                from:
                `"Industry & People" <${process.env.EMAIL_USER}>`,

                to:
                "aman.tripathi@logzerotechnologies.com",

                subject:
                "New Membership Request",

                html: `
                    <h3>New Membership Request Received</h3>

                    <table border="1" cellpadding="8" cellspacing="0">

                        <tr>
                            <td><b>Name</b></td>
                            <td>${full_name}</td>
                        </tr>

                        <tr>
                            <td><b>Email</b></td>
                            <td>${email}</td>
                        </tr>

                        <tr>
                            <td><b>Company</b></td>
                            <td>${company_name}</td>
                        </tr>

                        <tr>
                            <td><b>Industry</b></td>
                            <td>${industry}</td>
                        </tr>

                        <tr>
                            <td><b>Country</b></td>
                            <td>${country}</td>
                        </tr>

                    </table>
                `
            });

        } catch (emailError) {

            console.error(
                "Email Error:",
                emailError
            );
        }

        return res.status(200).json({

            success: true,

            message:
            "Membership request submitted successfully",

            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
            error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch all users 
--------------------------------------------------------------*/
const fetchUsers = async (req, res) => {
    try {
        const filters = {
            member_id: req.body.member_id || null,
            name: req.body.name || null,
            location: req.body.location || null,   // Open-ended location
            Job_title: req.body.Job_title || null,
            sector: req.body.sector || null,
            industry: req.body.industry || null,
            global_search: req.body.global_search || null // Global search
        };
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;
        // Check if any filter is applied
        const activeFilters = Object.values(filters).filter(v => v !== null && v !== '');
        if (activeFilters.length === 0) {
            return res.status(400).json({
                message: "Please apply at least one search filter to view users.",
                error: "No filters provided"
            });
        }
        // Fetch data
        const result = await User.fetch_users(filters, page, limit);
        res.status(200).json({
            message: "Users fetched successfully",
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            data: result.data
        });
    } catch (error) {
        console.error("Error fetching Users:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};

/*--------------------------------------------------------------
    Get single user by member_id
--------------------------------------------------------------*/
const user_detail = async (req, res) => {
    try {
        const { member_id } = req.body; // <-- from body
        const user = await User.fetch_userDetail(member_id);

        if (!user || user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({
            message: "User fetched successfully",
            data: user[0],
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};


/*--------------------------------------------------------------
    Controller to Update INP user Data
--------------------------------------------------------------*/
async function update_UserData(req, res) {
    try {
        const params = req.body;

        if (!params || Object.keys(params).length === 0) {
            return res.status(400).json({ message: "Bad update request" });
        }

        if (!params.member_id) {
            return res.status(400).json({ message: "member_id is required" });
        }

        const result = await User.updateUserData(params);

        if (!result || result.success !== true) {
            return res.status(400).json({
                message: "Update failed"
            });
        }

        // OPTIONAL: return updated data
        const updatedUser = await User.InpUserById(params.member_id);

        return res.status(200).json({
            message: "Data updated successfully!"
        });

    } catch (err) {
        console.error("Error in updating user:", err);

        return res.status(500).json({
            message: "Internal server error",
            error: err.message
        });
    }
}

/*--------------------------------------------------------------
    Function to fetch employees Working in a particular company
--------------------------------------------------------------*/
const getCompanyEmployees = async (req, res) => {
    try {
        const { company_id } = req.body; // Expecting company_id in request body
        if (!company_id) {
            return res.status(400).json({ 
                message: "Company ID is required in request body" 
            });
        }
        // Optional: Validate company_id format (assuming it's a string or number)
        if (typeof company_id !== 'string' && typeof company_id !== 'number') {
            return res.status(400).json({ 
                message: "Invalid company ID format" 
            });
        }
        const employees = await User.getEmployeesByCompany(company_id);
        if (!employees || employees.length === 0) {
            return res.status(200).json({ 
                message: "No employees found for this company",
                employees: [],
                company_id: company_id
            });
        }
        res.status(200).json({
            message: "Employees fetched successfully",
            company_id: company_id,
            employees: employees,
            total_employees: employees.length
        });
    } catch (error) {
        console.error("Error in getCompanyEmployees:", error);
        if (error.message === "Company ID is required") {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ 
            message: "Internal server error while fetching company employees",
            error: error.message 
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch highest education answers 
--------------------------------------------------------------*/
const HighestEducation = async (req, res) => {
    try {
        const data = await User.getHighestEducation();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No education answers found for question_id 65"
            });
        }
        res.status(200).json({
            message: "Highest education answers fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching education data:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Work Status answers 
--------------------------------------------------------------*/
const WorkStatus = async (req, res) => {
    try {
        const data = await User.getWorkStatus();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No work status found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Work status fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching work status:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Primary profession answers 
--------------------------------------------------------------*/
const PrimaryProfession = async (req, res) => {
    try {
        const data = await User.getProfessionType();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Primary profession found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Primary profession fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Primary profession:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch states based on country_id 
--------------------------------------------------------------*/
const getStates = async (req, res) => {
    try {

        const { country_id } = req.body;

        if (!country_id) {
            return res.status(400).json({
                message: "country_id is required in request body"
            });
        }

        let countryIds;

        try {
            countryIds = Array.isArray(country_id)
                ? country_id
                : JSON.parse(country_id);
        } catch {
            countryIds = [country_id];
        }

        const states = await User.getStatesByCountryId(countryIds);

        if (!states || states.length === 0) {
            return res.status(404).json({
                message: "No states found"
            });
        }

        return res.status(200).json({
            message: "States fetched successfully",
            data: states
        });

    } catch (error) {

        console.error("Error fetching states:", error);

        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Total Work Ex 
--------------------------------------------------------------*/
const TotalWorkEx = async (req, res) => {
    try {
        const data = await User.getTotalWorkEx();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Total Work Ex found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Total Work Ex fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Total Work Ex:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Seniority Level 
--------------------------------------------------------------*/
const SeniorityLevel = async (req, res) => {
    try {
        const data = await User.getSeniorityLevel();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Seniority Level found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Seniority Level fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Seniority Level:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Total Work Ex 
--------------------------------------------------------------*/
const WorkExCurrentCompany = async (req, res) => {
    try {
        const data = await User.getWorkExInCurrentCompany();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No  Work Ex in Current Company found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Work Ex in Current Company fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Work Ex in Current Company:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Business Model 
--------------------------------------------------------------*/
const BusinessModel = async (req, res) => {
    try {
        const data = await User.getBusinessModel();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Business Model found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Business Model fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Business Model:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Company Revenue 
--------------------------------------------------------------*/
const CompanyRevenue = async (req, res) => {
    try {
        const data = await User.getCompanyRevenue();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Company Revenue found for question_id 1"
            });
        }
        res.status(200).json({
            message: "Company Revenue fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Company Revenue:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Company Type 
--------------------------------------------------------------*/
const CompanyType = async (req, res) => {
    try {
        const data = await User.getCompanyType();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Company Type found for question_id 9"
            });
        }
        res.status(200).json({
            message: "Company Type fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Company Type:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Company Type 
--------------------------------------------------------------*/
const FetchYears = async (req, res) => {
    try {
        const data = await User.getYears();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Year found for question_id 41"
            });
        }
        res.status(200).json({
            message: "Years fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Years:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Company Type 
--------------------------------------------------------------*/
const FetchHouseholdIncome = async (req, res) => {
    try {
        const data = await User.getHouseholdIncome();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Household Income found for question_id 67"
            });
        }
        res.status(200).json({
            message: "Household Income fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Household Income:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Company Type 
--------------------------------------------------------------*/
const FetchEmployementStatus = async (req, res) => {
    try {
        const data = await User.getEmployementStatus();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Employement status found for question_id 2"
            });
        }
        res.status(200).json({
            message: "Employement status fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Employement status:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Function to fetch Department 
--------------------------------------------------------------*/
const FetchDepartment = async (req, res) => {
    try {
        const data = await User.getDepartment();
        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No Department found for question_id 71"
            });
        }
        res.status(200).json({
            message: "Department fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Department:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

/*------------------------------------------------------------------------------
    Function to fetch Functions by Department
    Pass department ID in req.body as { "department's question_answer_id": 1 }
------------------------------------------------------------------------------*/
const FetchFunction = async (req, res) => {
    try {
        const { question_answer_id } = req.body;

        if (!question_answer_id) {
            return res.status(400).json({
                message: "question answer id is required in request body"
            });
        }

        const data = await User.getFunctionByDepartment(question_answer_id);

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: `No Function found for question answer id ${question_answer_id}`
            });
        }

        res.status(200).json({
            message: "Functions fetched successfully",
            data
        });
    } catch (error) {
        console.error("Error fetching Function:", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

const checkReferral = async (req, res) => {
    try {
        const { referral_code } = req.body;
        if (!referral_code) {
            return res.status(400).json({ valid: false, message: "referral_code is required" });
        }
        const referrer = await User.validateReferral(referral_code);
        if (!referrer || referrer.length === 0) {
            return res.status(200).json({ valid: false, message: "Invalid referral code" });
        }
        return res.status(200).json({
            valid: true,
            referred_by: {
                member_id: referrer[0].member_id,
                name: `${referrer[0].first_name} ${referrer[0].last_name}`.trim()
            }
        });
    } catch (error) {
        console.error("Error validating referral:", error);
        res.status(500).json({ valid: false, message: "Database error" });
    }
};

const signupRequest = async (req, res) => {
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const { full_name, email, company_name, industry, country } = req.body;

        if (!full_name || !email || !company_name || !industry || !country) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        const existing = await User.getUserByEmail(email);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const result = await User.createSignupRequest(full_name, email, company_name, industry, country);

        try {
            await transporter.sendMail({
                from: `"Industry & People" <${process.env.EMAIL_USER}>`,
                to: "aman.tripathi@logzerotechnologies.com",
                subject: "New Signup Request",
                html: `<h3>New Signup Request</h3>
                    <p><b>Name:</b> ${full_name}</p>
                    <p><b>Email:</b> ${email}</p>
                    <p><b>Company:</b> ${company_name}</p>
                    <p><b>Industry:</b> ${industry}</p>
                    <p><b>Country:</b> ${country}</p>`
            });
        } catch (emailError) {
            console.error("Email Error:", emailError);
        }

        return res.status(200).json({
            success: true,
            message: "Your request has been submitted and is pending admin approval",
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const signup = async (req, res) => {
    try {
        const { name, email, password, company_name, sector, industry, referral_code } = req.body;

        if (!name || !email || !password || !company_name || !sector || !industry) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!referral_code) {
            return res.status(403).json({ message: "A valid referral is required to sign up directly" });
        }

        const referrer = await User.validateReferral(referral_code);
        if (!referrer || referrer.length === 0) {
            return res.status(400).json({ message: "Invalid referral code" });
        }

        const existingUser = await User.getUserByEmail(email);
        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        const newUser = await User.createUser(
            name,
            email,
            password,
            company_name,
            sector,
            industry,
            referrer[0].member_id   // <-- added: pass the validated referrer's member_id
        );

        const token = jwt.sign({ userId: newUser.insertId }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.status(201).json({ message: "User registered successfully", token });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Database error" });
    }
};
/*--------------------------------------------------------------
    Export the function separately 
--------------------------------------------------------------*/
module.exports = { 
    checkReferral,
    signupRequest,
    signup,
    login,
    membership_Request,
    fetchUsers,
    update_UserData,
    user_detail,
    getCompanyEmployees,
    HighestEducation,
    getStates,
    WorkStatus,
    PrimaryProfession,
    TotalWorkEx,
    SeniorityLevel,
    WorkExCurrentCompany,
    BusinessModel,
    CompanyRevenue,
    CompanyType,
    FetchYears,
    FetchHouseholdIncome,
    FetchEmployementStatus,
    FetchDepartment,
    FetchFunction
};