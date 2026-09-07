const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { aesEncrypt, aesDecrypt } = require("../utils/encryption");
const sendEmail = require("../utils/emailService");

const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const { getName } = require("country-list");

const User = require("../models/userModel");
const LoginActivity = require("../models/loginActivityModel");
const LoginSession = require("../models/loginSessionModel");
const PasswordResetModel = require("../models/PasswordResetModel");


const fs = require("fs");
const path = require("path");

dotenv.config();


const getLoginActivityInfo = (req) => {

    const userAgent = req.headers["user-agent"] || "";

    // -----------------------------------
    // GET IP ADDRESS
    // -----------------------------------

    const ip_address =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null;


    // -----------------------------------
    // PARSE USER AGENT
    // -----------------------------------

    const parser = new UAParser(userAgent);

    const deviceInfo = parser.getDevice();
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();


    // -----------------------------------
    // DEVICE
    // -----------------------------------

    let device = "Desktop";

    if (deviceInfo.type === "mobile") {
        device = "Mobile";
    } else if (deviceInfo.type === "tablet") {
        device = "Tablet";
    } else if (deviceInfo.type) {
        device = deviceInfo.type;
    }


    // -----------------------------------
    // BROWSER
    // -----------------------------------

    let browser = browserInfo.name || "Unknown";

    if (browserInfo.version) {
        browser = `${browser} ${browserInfo.version}`;
    }


    // -----------------------------------
    // OPERATING SYSTEM
    // -----------------------------------

    let operatingSystem = osInfo.name || "Unknown";

    if (osInfo.version) {
        operatingSystem = `${operatingSystem} ${osInfo.version}`;
    }


    // -----------------------------------
    // GEOLOCATION
    // -----------------------------------

    let city = null;
    let country = null;

    if (ip_address) {

        // Remove IPv6 prefix if present
        const cleanIp = ip_address.replace(/^::ffff:/, "");

        const geo = geoip.lookup(cleanIp);

        if (geo) {

            city = geo.city || null;

            if (geo.country) {
                country = getName(geo.country) || geo.country;
            }
        }
    }


    // -----------------------------------
    // RETURN LOGIN INFORMATION
    // -----------------------------------

    return {

        ip_address,

        city,

        country,

        user_agent: userAgent,

        device,

        browser,

        operating_system: operatingSystem
    };
};

const recordLoginActivity = async (
    req,
    {
        u_id = null,
        member_id = null,
        login_type,
        login_status
    }
) => {

    try {

        const activityInfo = getLoginActivityInfo(req);

        await LoginActivity.createLoginActivity({
            u_id,
            member_id,
            ip_address: activityInfo.ip_address,
            city: activityInfo.city,
            country: activityInfo.country,
            user_agent: activityInfo.user_agent,
            device: activityInfo.device,
            browser: activityInfo.browser,
            operating_system: activityInfo.operating_system,
            login_type,
            login_status
        });

    } catch (error) {

        // Login activity should NEVER stop the login itself
        console.error(
            "Failed to record login activity:",
            error
        );
    }
};


/*--------------------------------------------------------------
    Create Active Login Session
--------------------------------------------------------------*/
const createLoginSession = async (
    req,
    {
        u_id,
        member_id,
        session_token
    }
) => {

    try {

        const activityInfo = getLoginActivityInfo(req);

        const expires_at = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );

        const result = await LoginSession.createLoginSession({
            u_id,
            member_id,
            session_token,
            ip_address: activityInfo.ip_address,
            user_agent: activityInfo.user_agent,
            device: activityInfo.device,
            browser: activityInfo.browser,
            operating_system: activityInfo.operating_system,
            expires_at
        });

        return result.id;

    } catch (error) {

        console.error(
            "Failed to create login session:",
            error
        );

        return null;
    }
};

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

            await recordLoginActivity(req, {
                u_id: null,
                member_id: null,
                login_type: 1,
                login_status: 0
            });

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

            await recordLoginActivity(req, {
                u_id: user[0].id,
                member_id: user[0].member_id,
                login_type: 1,
                login_status: 0
            });

            return res.status(401).json({
                message: "Incorrect password"
            });
        }

        // -----------------------------------
        // CHECK 2FA STATUS
        // -----------------------------------

        // -----------------------------------
// CHECK 2FA STATUS
// -----------------------------------
const twoFactorStatus = await User.getTwoFactorStatus(
    user[0].id
);

// -----------------------------------
// IF 2FA IS ENABLED
// -----------------------------------
if (twoFactorStatus.is_enabled) {

    // -----------------------------------
    // EMAIL 2FA
    // -----------------------------------
    if (twoFactorStatus.auth_method === "email") {

        // -----------------------------------
        // GET USER DETAILS
        // -----------------------------------
        const userDetails = await User.getLoggedinUser(
            user[0].member_id
        );

        if (!userDetails || userDetails.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User details not found"
            });
        }

        // -----------------------------------
        // DECRYPT PERSONAL EMAIL
        // -----------------------------------
        const personalEmail = userDetails[0].personal_email
            ? aesDecrypt(userDetails[0].personal_email)
            : null;

        if (!personalEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found"
            });
        }

        // -----------------------------------
        // GENERATE 6 DIGIT OTP
        // -----------------------------------
        const otp = crypto
            .randomInt(100000, 1000000)
            .toString();

        // -----------------------------------
        // HASH OTP
        // -----------------------------------
        const otpHash = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        // -----------------------------------
        // OTP VALID FOR 5 MINUTES
        // -----------------------------------
        const otpExpiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // -----------------------------------
        // SAVE LOGIN OTP
        // -----------------------------------
        const otpResult = await User.createEmailLoginOTP(
            user[0].id,
            otpHash,
            otpExpiresAt
        );

        if (!otpResult.success) {
            return res.status(500).json({
                success: false,
                message: "Unable to generate login OTP"
            });
        }

        // -----------------------------------
        // SEND LOGIN OTP EMAIL
        // -----------------------------------
        try {

            const emailResult = await sendEmail({
                to: personalEmail,
                subject: "Your Login Verification OTP",
                content: `
                    <div style="font-family: Arial, sans-serif;">

                        <h2>Login Verification</h2>

                        <p>
                            Hello ${userDetails[0].first_name || "User"},
                        </p>

                        <p>
                            We received a login attempt on your
                            Industry & People account.
                        </p>

                        <p>
                            Use the following OTP to complete your login:
                        </p>

                        <div style="
                            font-size: 30px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            margin: 20px 0;
                        ">
                            ${otp}
                        </div>

                        <p>
                            This OTP is valid for
                            <strong>5 minutes</strong>.
                        </p>

                        <p>
                            If you did not attempt to log in,
                            please ignore this email.
                        </p>

                    </div>
                `
            });

            if (!emailResult || !emailResult.status) {

                await User.clearEmailLoginOTP(
                    user[0].id
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to send login OTP"
                });
            }

        } catch (emailError) {

            console.error(
                "Login OTP email error:",
                emailError
            );

            await User.clearEmailLoginOTP(
                user[0].id
            );

            return res.status(500).json({
                success: false,
                message: "Unable to send login OTP"
            });
        }
    }

    // -----------------------------------
    // CREATE TEMPORARY 2FA TOKEN
    // -----------------------------------
    const twoFactorToken = jwt.sign(
        {
            userId: user[0].id,
            member_id: user[0].member_id,
            purpose: "2FA_LOGIN"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "5m"
        }
    );

    // -----------------------------------
    // RESPONSE
    // -----------------------------------
    return res.status(200).json({
        success: true,
        message: "Two-factor authentication required",
        requires_2fa: true,
        auth_method: twoFactorStatus.auth_method,
        two_factor_token: twoFactorToken
    });
}

        // -----------------------------------
        // NORMAL LOGIN - 2FA NOT ENABLED
        // -----------------------------------

        const token = jwt.sign(
            {
                userId: user[0].id,
                member_id: user[0].member_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        await recordLoginActivity(req, {
            u_id: user[0].id,
            member_id: user[0].member_id,
            login_type: 1,
            login_status: 1
        });

        await createLoginSession(req, {
            u_id: user[0].id,
            member_id: user[0].member_id,
            session_token: token
        });

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

const verifyTwoFactorLogin = async (req, res) => {

    try {

        // -----------------------------------
        // GET TEMPORARY 2FA TOKEN DATA
        // -----------------------------------

        const userId = req.user?.userId;
        const member_id = req.user?.member_id;

        if (!userId || !member_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid two-factor authentication token"
            });
        }

        // -----------------------------------
        // CHECK TOKEN PURPOSE
        // -----------------------------------

        if (req.user?.purpose !== "2FA_LOGIN") {

            return res.status(401).json({
                success: false,
                message: "Invalid two-factor authentication token"
            });
        }

        // -----------------------------------
        // GET OTP
        // -----------------------------------

        const { otp } = req.body;

        if (!otp) {

            return res.status(400).json({
                success: false,
                message: "OTP is required"
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {

            return res.status(400).json({
                success: false,
                message: "OTP must be a 6-digit number"
            });
        }

        // -----------------------------------
        // GET 2FA DATA
        // -----------------------------------

        const rows = await User.getTwoFactorSecret(
            userId
        );

        if (!rows || rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "2FA setup not found"
            });
        }

        const twoFactorData = rows[0];

        // -----------------------------------
        // CHECK 2FA ENABLED
        // -----------------------------------

        if (twoFactorData.is_enabled !== 1) {

            return res.status(400).json({
                success: false,
                message: "Two-factor authentication is not enabled"
            });
        }

        // =====================================================
        // AUTHENTICATOR
        // =====================================================

        if (
            twoFactorData.auth_method ===
            "authenticator"
        ) {

            if (!twoFactorData.secret) {

                return res.status(404).json({
                    success: false,
                    message: "2FA secret not found"
                });
            }

            const verified =
                speakeasy.totp.verify({

                    secret: twoFactorData.secret,

                    encoding: "base32",

                    token: String(otp),

                    window: 1
                });

            if (!verified) {

                await recordLoginActivity(req, {
                    u_id: userId,
                    member_id: member_id,
                    login_type: 2,
                    login_status: 0
                });

                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }
        }

        // =====================================================
        // EMAIL OTP
        // =====================================================

        else if (
            twoFactorData.auth_method ===
            "email"
        ) {

            if (!twoFactorData.email_otp) {

                return res.status(400).json({
                    success: false,
                    message: "Email OTP not found"
                });
            }

            // -----------------------------------
            // CHECK EXPIRY
            // -----------------------------------

            if (
                !twoFactorData.otp_expires_at ||
                new Date(twoFactorData.otp_expires_at) <
                new Date()
            ) {

                await User.clearEmailLoginOTP(
                    userId
                );

                return res.status(400).json({
                    success: false,
                    message: "Email OTP has expired"
                });
            }

            // -----------------------------------
            // HASH ENTERED OTP
            // -----------------------------------

            const otpHash = crypto
                .createHash("sha256")
                .update(String(otp))
                .digest("hex");

            // -----------------------------------
            // VERIFY
            // -----------------------------------

            if (
                otpHash !==
                twoFactorData.email_otp
            ) {

                await recordLoginActivity(req, {
                    u_id: userId,
                    member_id: member_id,
                    login_type: 2,
                    login_status: 0
                });

                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }

            // -----------------------------------
            // CLEAR OTP AFTER SUCCESS
            // -----------------------------------

            await User.clearEmailLoginOTP(
                userId
            );
        }

        // =====================================================
        // INVALID AUTH METHOD
        // =====================================================

        else {

            return res.status(400).json({
                success: false,
                message: "Invalid 2FA authentication method"
            });
        }

        // -----------------------------------
        // GENERATE NORMAL LOGIN TOKEN
        // -----------------------------------

        const token = jwt.sign(
            {
                userId: userId,
                member_id: member_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        // -----------------------------------
        // LOGIN ACTIVITY
        // -----------------------------------

        await recordLoginActivity(req, {
            u_id: userId,
            member_id: member_id,
            login_type: 2,
            login_status: 1
        });

        // -----------------------------------
        // CREATE LOGIN SESSION
        // -----------------------------------

        await createLoginSession(req, {
            u_id: userId,
            member_id: member_id,
            session_token: token
        });

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token
        });

    } catch (error) {

        console.error(
            "Error verifying 2FA login:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
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

// Get single user by member_id
const getUserDetail = async (req, res) => {
    try {
        const member_id = req.user.member_id;

        if (!member_id) {
            return res.status(401).json({
                message: "User information not found in token"
            });
        }

        const user = await User.getLoggedinUser(member_id);

        if (!user || user.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const userData = user[0];

        // ==================================================
        // PREVIOUS EMPLOYMENT
        // ==================================================

        let previousEmployment = [];

        if (userData.previous_employement) {
            try {
                previousEmployment =
                    typeof userData.previous_employement === "string"
                        ? JSON.parse(userData.previous_employement)
                        : userData.previous_employement;

                if (!Array.isArray(previousEmployment)) {
                    previousEmployment = [];
                }
            } catch (error) {
                console.error(
                    "Error parsing previous employment:",
                    error
                );

                previousEmployment = [];
            }
        }

        userData.previous_employement = previousEmployment.map(
            (employment) => ({
                company_name: employment.company_name || "",
                job_title: employment.job_title || "",
                from: employment.from || "",
                to: employment.to || "",
                location: employment.location || "",
                job_description: employment.job_description || ""
            })
        );

        // ==================================================
        // DECRYPT PERSONAL EMAIL
        // ==================================================

        userData.personal_email = userData.personal_email
            ? aesDecrypt(userData.personal_email)
            : null;

        userData.work_email = userData.work_email
            ? aesDecrypt(userData.work_email)
            : null;

        userData.mobile = userData.mobile
            ? aesDecrypt(userData.mobile)
            : null;

            // ==================================================
            // PROFILE COMPLETION
            // ==================================================

            const basicInformation =
                !!userData.first_name &&
                !!userData.last_name &&
                !!userData.personal_email &&
                !!userData.mobile &&
                !!userData.age_entered &&
                !!userData.gender;

            const emailVerified =
                userData.email_verified === 1;

            const countryAdded =
                !!userData.country;

            const industryAdded =
                !!userData.industry;

            const educationDetails =
                !!userData.highest_education;

            const careerDetails =
                !!userData.work_experience;

            const companyDetails =
                userData.company_details_added === 1;

            const previousEmployer =
                userData.previous_employement !== null &&
                userData.previous_employement !== undefined &&
                userData.previous_employement !== "";

            const profilePhoto =
                !!userData.profile_photo;


                const completionItems = [
                basicInformation,
                emailVerified,
                countryAdded,
                industryAdded,
                educationDetails,
                careerDetails,
                companyDetails,
                previousEmployer,
                profilePhoto
            ];

            const completedCount =
                completionItems.filter(Boolean).length;

            const totalItems =
                completionItems.length;

            const percentage =
                Math.round(
                    (completedCount / totalItems) * 100
                );

                const profileCompletion = {

                percentage,

                basic_information:
                    basicInformation,

                email_verified:
                    emailVerified,

                country_added:
                    countryAdded,

                industry_added:
                    industryAdded,

                education_details:
                    educationDetails,

                career_details:
                    careerDetails,

                company_details:
                    companyDetails,

                previous_employer:
                    previousEmployer,

                profile_photo:
                    profilePhoto
            };

        return res.status(200).json({
            message: "User fetched successfully",
            data: userData,
            profile_completion: profileCompletion
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Database error",
            error: error.message
        });
    }
};

/*--------------------------------------------------------------
    Upload / Update User Profile Photo
--------------------------------------------------------------*/
const uploadProfilePhoto = async (req, res) => {

    try {

        // Check image
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Profile photo is required"
            });
        }

        const { member_id } = req.body;

        // Check member_id
        if (!member_id) {

            // Delete uploaded file
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(400).json({
                success: false,
                message: "member_id is required"
            });
        }

        // Path saved in database
        const photoPath =
            `/uploads/profile_photos/${req.file.filename}`;

        // Update database
        const result = await User.updateProfilePhoto(
            member_id,
            photoPath
        );

        // Delete old photo if user already had one
        if (result.oldPhoto) {

            const oldPhotoPath = path.join(
                __dirname,
                "..",
                "public",
                result.oldPhoto.replace(/^\/+/, "")
            );

            if (
                fs.existsSync(oldPhotoPath) &&
                oldPhotoPath !== req.file.path
            ) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Full URL
        const baseUrl =
            `${req.protocol}://${req.get("host")}`;

        return res.status(200).json({

            success: true,

            message: result.oldPhoto
                ? "Profile photo updated successfully"
                : "Profile photo uploaded successfully",

            data: {
                member_id: member_id,

                profile_photo: photoPath,

                profile_photo_url:
                    `${baseUrl}${photoPath}`
            }
        });

    } catch (error) {

        console.error(
            "Error uploading profile photo:",
            error
        );

        // Delete newly uploaded image if database operation fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            success: false,
            message: "Failed to upload profile photo",
            error: error.message
        });
    }
};


/*--------------------------------------------------------------
    Controller to Update INP user Data
--------------------------------------------------------------*/
async function update_UserData(req, res) {

    try {

        // -----------------------------------
        // GET LOGGED-IN USER FROM JWT
        // -----------------------------------

        const member_id = req.user?.member_id;

        if (!member_id) {
            return res.status(401).json({
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // REQUEST BODY
        // -----------------------------------

        const params = req.body;

        if (!params || Object.keys(params).length === 0) {
            return res.status(400).json({
                message: "Bad update request"
            });
        }

        // -----------------------------------
        // UPDATE USER
        // -----------------------------------

        const result = await User.updateUserData(
            member_id,
            params
        );

        if (!result || result.success !== true) {

            return res.status(400).json({
                message: "Update failed"
            });
        }

        // -----------------------------------
        // FETCH UPDATED USER
        // -----------------------------------

        const updatedUser =
            await User.getLoggedinUser(member_id);

        if (!updatedUser || updatedUser.length === 0) {

            return res.status(404).json({
                message: "User not found"
            });
        }

        const updatedUserData = updatedUser[0];

        // -----------------------------------
        // DECRYPT DATA
        // -----------------------------------

        updatedUserData.personal_email =
            updatedUserData.personal_email
                ? aesDecrypt(updatedUserData.personal_email)
                : null;

        updatedUserData.work_email =
            updatedUserData.work_email
                ? aesDecrypt(updatedUserData.work_email)
                : null;

        updatedUserData.mobile =
            updatedUserData.mobile
                ? aesDecrypt(updatedUserData.mobile)
                : null;

        // -----------------------------------
        // RESPONSE
        // -----------------------------------

        return res.status(200).json({

            message: "Data updated successfully!",

            data: updatedUserData

        });

    } catch (err) {

        console.error(
            "Error in updating user:",
            err
        );

        return res.status(500).json({

            message: "Internal server error",

            error: err.message

        });
    }
}


/*--------------------------------------------------------------
    Change Password
--------------------------------------------------------------*/
const changePassword = async (req, res) => {
    try {

        // -----------------------------------
        // GET LOGGED-IN USER FROM JWT
        // -----------------------------------

        const member_id = req.user?.member_id;

        if (!member_id) {
            return res.status(401).json({
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // GET USER EMAIL
        // -----------------------------------

        const userData = await User.getUserEmailByMemberId(member_id);

        if (!userData) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        let userEmail;

        try {
            userEmail = aesDecrypt(userData.personal_email);
        } catch (error) {
            console.error("Email decryption error:", error);

            return res.status(500).json({
                message: "Unable to retrieve user email"
            });
        }

        // -----------------------------------
        // REQUEST BODY
        // -----------------------------------

        const {
            current_password,
            new_password,
            confirm_password
        } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (
            !current_password ||
            !new_password ||
            !confirm_password
        ) {
            return res.status(400).json({
                message:
                    "Current password, new password and confirm password are required"
            });
        }

        // -----------------------------------
        // CHECK PASSWORD MATCH
        // -----------------------------------

        if (new_password !== confirm_password) {
            return res.status(400).json({
                message: "New password and confirm password do not match"
            });
        }

        // -----------------------------------
        // CHANGE PASSWORD
        // -----------------------------------

        const result = await User.changeUserPassword(
            member_id,
            current_password,
            new_password
        );

        // -----------------------------------
        // USER NOT FOUND
        // -----------------------------------

        if (
            !result.success &&
            result.code === "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // -----------------------------------
        // PASSWORD DECRYPTION ERROR
        // -----------------------------------

        if (
            !result.success &&
            result.code === "PASSWORD_DECRYPT_FAILED"
        ) {
            return res.status(500).json({
                message: "Unable to verify current password"
            });
        }

        // -----------------------------------
        // WRONG CURRENT PASSWORD
        // -----------------------------------

        if (
            !result.success &&
            result.code === "INVALID_CURRENT_PASSWORD"
        ) {
            return res.status(401).json({
                message: "Current password is incorrect"
            });
        }

        // -----------------------------------
        // SAME PASSWORD
        // -----------------------------------

        if (
            !result.success &&
            result.code === "SAME_PASSWORD"
        ) {
            return res.status(400).json({
                message:
                    "New password must be different from current password"
            });
        }

        // -----------------------------------
        // UPDATE FAILED
        // -----------------------------------

        if (
            !result.success &&
            result.code === "UPDATE_FAILED"
        ) {
            return res.status(500).json({
                message: "Password update failed"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------


        const emailResult = await sendEmail({
            to: userEmail,
            subject: "Your Password Has Been Changed",
            content: `
                <div style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: auto;
                ">

                    <h2 style="color: #c92332;">
                        Password Changed Successfully
                    </h2>

                    <p>
                        Hello ${userData.first_name || "User"},
                    </p>

                    <p>
                        Your <strong>Industry & People</strong> account password
                        has been changed successfully.
                    </p>

                    <p>
                        If you made this change, no further action is required.
                    </p>

                    <p>
                        <strong>
                            If you did not change your password, please contact
                            our support team immediately.
                        </strong>
                    </p>

                    <p>
                        For your security, please contact us immediately if you
                        believe someone else has accessed your account.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>Industry & People Team</strong>
                    </p>

                </div>
            `
        });

        if (!emailResult || !emailResult.status) {
            console.error(
                "Password change notification email failed:",
                emailResult
            );
        }

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {

        console.error(
            "Error changing password:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const forgotPassword = async (req, res) => {
    try {

        const { email } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!email || email.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const userEmail = email.trim();

        // -----------------------------------
        // FIND USER
        // -----------------------------------

        const user = await User.getUserByEmail(userEmail);

        if (!user || user.length === 0) {
            return res.status(200).json({
                success: true,
                message:
                    "If an account exists with this email, a password reset link has been sent."
            });
        }

        const userData = user[0];

        // -----------------------------------
        // GENERATE RESET TOKEN
        // -----------------------------------

        const rawToken = crypto
            .randomBytes(32)
            .toString("hex");

        // -----------------------------------
        // HASH TOKEN
        // -----------------------------------

        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        // -----------------------------------
        // TOKEN EXPIRY - 30 MINUTES
        // -----------------------------------

        const expiresAt = new Date(
            Date.now() + 30 * 60 * 1000
        );

        // -----------------------------------
        // SAVE TOKEN
        // -----------------------------------

        await PasswordResetModel.createPasswordResetToken(
            userData.member_id,
            userEmail,
            tokenHash,
            expiresAt
        );

        // -----------------------------------
        // RESET PASSWORD URL
        // -----------------------------------

        const resetUrl =
            `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        // -----------------------------------
        // SEND EMAIL
        // -----------------------------------

        const emailResult = await sendEmail({
            to: userEmail,
            subject: "Reset Your Password",
            content: `
                <div style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: auto;
                ">

                    <h2 style="color: #c92332;">
                        Reset Your Password
                    </h2>

                    <p>
                        Hello ${userData.first_name || "User"},
                    </p>

                    <p>
                        We received a request to reset the password
                        associated with your Industry & People account.
                    </p>

                    <p>
                        Click the button below to create a new password.
                    </p>

                    <div style="margin: 25px 0;">
                        <a
                            href="${resetUrl}"
                            style="
                                background-color: #c92332;
                                color: #ffffff;
                                padding: 12px 24px;
                                text-decoration: none;
                                border-radius: 5px;
                                display: inline-block;
                            "
                        >
                            Reset Password
                        </a>
                    </div>

                    <p>
                        This password reset link will expire in
                        <strong>30 minutes</strong>.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>Industry & People Team</strong>
                    </p>

                </div>
            `
        });

        // -----------------------------------
        // EMAIL FAILED
        // -----------------------------------

        if (!emailResult || !emailResult.status) {

            console.error(
                "Password reset email failed:",
                emailResult
            );

            return res.status(500).json({
                success: false,
                message: "Unable to send password reset email"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message:
                "If an account exists with this email, a password reset link has been sent."
        });

    } catch (error) {

        console.error(
            "Error in forgot password:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const resetPassword = async (req, res) => {
    try {

        const {
            token,
            new_password,
            confirm_password
        } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!token || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Token, new password and confirm password are required"
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        // -----------------------------------
        // HASH TOKEN
        // -----------------------------------

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // -----------------------------------
        // VALIDATE TOKEN
        // -----------------------------------

        const tokenData =
            await PasswordResetModel.getValidPasswordResetToken(
                tokenHash
            );

        if (!tokenData) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired password reset link"
            });
        }

        // -----------------------------------
        // UPDATE PASSWORD
        // -----------------------------------

        const result =
            await User.setInitialPassword(
                tokenData.member_id,
                new_password
            );

        if (!result || result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to reset password"
            });
        }

        // -----------------------------------
        // MARK TOKEN AS USED
        // -----------------------------------

        await PasswordResetModel.markPasswordResetTokenUsed(
            tokenData.id
        );

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now login."
        });

    } catch (error) {

        console.error(
            "Error resetting password:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
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

        const {
            full_name,
            email,
            linkedin
        } = req.body;

        if (!full_name || !email || !linkedin) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Check if user already exists
        const existing = await User.getUserByEmail(email);

        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        // Check if membership request already exists
        const existingRequest = await User.getSignupRequestByEmail(email);

        if (existingRequest.length > 0) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted a membership request."
            });
        }

        const result = await User.createSignupRequest(
            full_name,
            email,
            linkedin
        );

        // -----------------------------------
        // SEND EMAIL TO ADMIN
        // -----------------------------------

        try {
            await sendEmail({
                to: process.env.ADMIN_EMAIL,
                subject: "New Membership Request",
                content: `
                    <h2>New Membership Request Received</h2>

                    <table border="1" cellpadding="8" cellspacing="0"
                        style="border-collapse:collapse;">

                        <tr>
                            <td><strong>Name</strong></td>
                            <td>${full_name}</td>
                        </tr>

                        <tr>
                            <td><strong>Email</strong></td>
                            <td>${email}</td>
                        </tr>

                        <tr>
                            <td><strong>LinkedIn</strong></td>
                            <td>
                                <a href="${linkedin}" target="_blank">
                                    ${linkedin}
                                </a>
                            </td>
                        </tr>

                    </table>

                    <br>

                    <p>
                        A new membership request has been submitted
                        and is waiting for review.
                    </p>
                `
            });
        } catch (emailError) {
            console.error("Admin Email Error:", emailError);
        }


        // -----------------------------------
        // SEND CONFIRMATION EMAIL TO USER
        // -----------------------------------

        try {
            await sendEmail({
                to: email,
                subject: "Membership Request Submitted Successfully",
                content: `
                    <div style="
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: auto;
                    ">

                        <h2 style="color: #c92332;">
                            Membership Request Submitted
                        </h2>

                        <p>
                            Hello ${full_name},
                        </p>

                        <p>
                            Thank you for your interest in
                            <strong>Industry & People</strong>.
                        </p>

                        <p>
                            Your membership request has been
                            <strong>successfully submitted</strong>.
                        </p>

                        <p>
                            Our team will review your request and
                            notify you once a decision has been made.
                        </p>

                        <p>
                            Please note that submitting a membership
                            request does not guarantee approval.
                        </p>

                        <p>
                            You do not need to take any further action
                            at this time.
                        </p>

                        <p>
                            Regards,<br>
                            <strong>Industry & People Team</strong>
                        </p>

                    </div>
                `
            });
        } catch (emailError) {
            console.error("User Confirmation Email Error:", emailError);
        }

        return res.status(200).json({
            success: true,
            message: "Your request has been submitted successfully.",
            data: result
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const signup = async (req, res) => {
    try {
        const {
            name,
            email,
            password,

            company_name,
            other_company,

            sector,
            other_sector,

            industry,
            other_industry,

            country,
            other_country,

            referral_code
        } = req.body;

        // -----------------------------------
        // BASIC VALIDATION
        // -----------------------------------

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, Email and Password are required"
            });
        }

        if (!company_name && !other_company) {
            return res.status(400).json({
                message: "Company is required"
            });
        }

        if (!sector && !other_sector) {
            return res.status(400).json({
                message: "Sector is required"
            });
        }

        if (!industry && !other_industry) {
            return res.status(400).json({
                message: "Industry is required"
            });
        }

        if (!country && !other_country) {
            return res.status(400).json({
                message: "Country is required"
            });
        }

        // -----------------------------------
        // REFERRAL VALIDATION
        // -----------------------------------

        if (!referral_code) {
            return res.status(403).json({
                message: "A valid referral is required to sign up directly"
            });
        }

        const referrer = await User.validateReferral(referral_code);

        if (!referrer || referrer.length === 0) {
            return res.status(400).json({
                message: "Invalid referral code"
            });
        }

        // -----------------------------------
        // CHECK EXISTING USER
        // -----------------------------------

        const existingUser = await User.getUserByEmail(email);

        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // -----------------------------------
        // CREATE USER
        // -----------------------------------

        const newUser = await User.createUser(
            name,
            email,
            password,

            company_name,
            other_company,

            sector,
            other_sector,

            industry,
            other_industry,

            country,
            other_country,

            referrer[0].member_id
        );

        // -----------------------------------
        // SEND ACCOUNT CREATED EMAIL
        // -----------------------------------

        try {

            const emailResult = await sendEmail({
                to: email,
                subject: "Your Industry & People Account Has Been Created",
                content: `
                    <div style="
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: auto;
                    ">

                        <h2 style="color: #c92332;">
                            Welcome to Industry & People
                        </h2>

                        <p>
                            Hello ${name},
                        </p>

                        <p>
                            Your <strong>Industry & People</strong> account
                            has been successfully created.
                        </p>

                        <p>
                            You can now log in using the email address
                            associated with your account.
                        </p>

                        <p>
                            Your account has been created through a valid
                            referral and is now ready to use.
                        </p>

                        <p>
                            <strong>
                                For your security, please do not share
                                your password with anyone.
                            </strong>
                        </p>

                        <p>
                            If you did not create this account or believe
                            someone has used your information without your
                            permission, please contact our support team
                            immediately.
                        </p>

                        <p>
                            Regards,<br>
                            <strong>Industry & People Team</strong>
                        </p>

                    </div>
                `
            });

            // Check email service response
            if (!emailResult || !emailResult.status) {
                console.error(
                    "Account Creation Email Failed:",
                    emailResult
                );
            }

        } catch (emailError) {

            console.error(
                "Account Creation Email Error:",
                emailError
            );
        }

        // -----------------------------------
        // GENERATE JWT
        // -----------------------------------

        const token = jwt.sign(
            {
                userId: newUser.insertId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        // -----------------------------------
        // SUCCESS RESPONSE
        // -----------------------------------

        return res.status(201).json({
            message: "User registered successfully",
            token
        });

    } catch (err) {

        console.error(
            "Signup Error:",
            err
        );

        return res.status(500).json({
            message: "Database error"
        });
    }
};


/*--------------------------------------------------------------
    Get 2FA Status
--------------------------------------------------------------*/
const getTwoFactorStatus = async (req, res) => {
    try {

        // -----------------------------------
        // GET LOGGED-IN USER FROM JWT
        // -----------------------------------

        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // GET 2FA STATUS
        // -----------------------------------

        const result = await User.getTwoFactorStatus(u_id);

        return res.status(200).json({
            success: true,
            data: {
                is_enabled: result.is_enabled
            }
        });

    } catch (error) {

        console.error(
            "Error fetching 2FA status:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

/*--------------------------------------------------------------
    Setup 2FA
--------------------------------------------------------------*/
const setupTwoFactor = async (req, res) => {
    try {

        // -----------------------------------
        // GET AUTH METHOD
        // -----------------------------------

        const { auth_method } = req.body;

        if (!auth_method) {
            return res.status(400).json({
                success: false,
                message: "auth_method is required"
            });
        }

        if (!["authenticator", "email"].includes(auth_method)) {
            return res.status(400).json({
                success: false,
                message: "Invalid auth_method. Use authenticator or email"
            });
        }

        // -----------------------------------
        // GET LOGGED-IN USER
        // -----------------------------------

        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // CHECK CURRENT 2FA STATUS
        // -----------------------------------

        const status = await User.getTwoFactorStatus(u_id);

        if (status.is_enabled) {
            return res.status(400).json({
                success: false,
                message: "Two-factor authentication is already enabled"
            });
        }

        // -----------------------------------
        // GET USER DETAILS
        // -----------------------------------

        const member_id = req.user?.member_id;

        if (!member_id) {
            return res.status(401).json({
                success: false,
                message: "Member information not found in token"
            });
        }

        const user = await User.getLoggedinUser(member_id);

        if (!user || user.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userData = user[0];

        // -----------------------------------
        // DECRYPT PERSONAL EMAIL
        // -----------------------------------

        const personalEmail = userData.personal_email
            ? aesDecrypt(userData.personal_email)
            : null;

        if (!personalEmail) {
            return res.status(400).json({
                success: false,
                message: "User email not found"
            });
        }

        // ==================================================
        // EMAIL OTP 2FA
        // ==================================================

        if (auth_method === "email") {

            // -----------------------------------
            // GENERATE 6 DIGIT OTP
            // -----------------------------------

            const otp = crypto
                .randomInt(100000, 1000000)
                .toString();

            // -----------------------------------
            // HASH OTP BEFORE STORING
            // -----------------------------------

            const otpHash = crypto
                .createHash("sha256")
                .update(otp)
                .digest("hex");

            // -----------------------------------
            // OTP VALID FOR 5 MINUTES
            // -----------------------------------

            const otpExpiresAt = new Date(
                Date.now() + 5 * 60 * 1000
            );

            // -----------------------------------
            // SAVE OTP
            // -----------------------------------

            const result = await User.createEmailTwoFactorOTP(
                u_id,
                otpHash,
                otpExpiresAt
            );

            if (!result.success) {

                if (result.code === "ALREADY_ENABLED") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Two-factor authentication is already enabled"
                    });
                }

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to setup email two-factor authentication"
                });
            }

            // -----------------------------------
            // SEND OTP EMAIL
            // -----------------------------------

            const emailResult = await sendEmail({
                to: personalEmail,
                subject: "Your Two-Factor Authentication OTP",
                content: `
                    <div style="font-family: Arial, sans-serif;">

                        <h2>Two-Factor Authentication</h2>

                        <p>
                            Hello ${userData.first_name || "User"},
                        </p>

                        <p>
                            Use the following verification code to
                            enable Two-Factor Authentication:
                        </p>

                        <div style="
                            font-size: 30px;
                            font-weight: bold;
                            letter-spacing: 8px;
                            margin: 20px 0;
                        ">
                            ${otp}
                        </div>

                        <p>
                            This OTP is valid for
                            <strong>5 minutes</strong>.
                        </p>

                        <p>
                            If you did not request this, please ignore
                            this email.
                        </p>

                    </div>
                `
            });

            // -----------------------------------
            // EMAIL FAILED
            // -----------------------------------

            if (!emailResult.status) {

                // Clear OTP if email could not be sent
                await User.clearEmailTwoFactorOTP(u_id);

                return res.status(500).json({
                    success: false,
                    message: "Unable to send OTP email"
                });
            }

            // -----------------------------------
            // EMAIL OTP SENT SUCCESSFULLY
            // -----------------------------------

            return res.status(200).json({
                success: true,
                message: "2FA email OTP sent successfully"
            });
        }

        // ==================================================
        // AUTHENTICATOR APP 2FA
        // ==================================================

        // -----------------------------------
        // GENERATE SECRET
        // -----------------------------------

        const secret = speakeasy.generateSecret({
            name: `Industry & People (${personalEmail})`,
            issuer: "Industry & People"
        });

        // -----------------------------------
        // SAVE SECRET
        // -----------------------------------

        const result = await User.createTwoFactorSecret(
            u_id,
            secret.base32
        );

        if (!result.success) {

            if (result.code === "ALREADY_ENABLED") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Two-factor authentication is already enabled"
                });
            }

            return res.status(500).json({
                success: false,
                message:
                    "Unable to setup two-factor authentication"
            });
        }

        // -----------------------------------
        // GENERATE QR CODE
        // -----------------------------------

        const qrCode = await QRCode.toDataURL(
            secret.otpauth_url
        );

        // -----------------------------------
        // RESPONSE
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "2FA setup initiated",
            data: {
                qr_code: qrCode,
                secret: secret.base32
            }
        });

    } catch (error) {

        console.error(
            "Error setting up 2FA:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/*--------------------------------------------------------------
    Verify 2FA Setup
--------------------------------------------------------------*/
const verifyTwoFactor = async (req, res) => {

    try {

        // -----------------------------------
        // GET LOGGED-IN USER
        // -----------------------------------

        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // GET OTP
        // -----------------------------------

        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required"
            });
        }

        // -----------------------------------
        // OTP MUST BE 6 DIGITS
        // -----------------------------------

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                success: false,
                message: "OTP must be a 6-digit number"
            });
        }

        // -----------------------------------
        // GET 2FA DATA
        // -----------------------------------

        const result = await User.verifyTwoFactorOTP(u_id);

        if (!result.success) {

            if (result.code === "2FA_NOT_SETUP") {
                return res.status(404).json({
                    success: false,
                    message: "2FA setup not found"
                });
            }

            return res.status(400).json({
                success: false,
                message: "Unable to verify 2FA"
            });
        }

        const twoFactorData = result.data;

        // -----------------------------------
        // CHECK AUTH METHOD
        // -----------------------------------

        const authMethod = twoFactorData.auth_method;

        // =====================================================
        // AUTHENTICATOR APP
        // =====================================================

        if (authMethod === "authenticator") {

            if (!twoFactorData.secret) {
                return res.status(404).json({
                    success: false,
                    message: "2FA secret not found"
                });
            }

            const verified = speakeasy.totp.verify({
                secret: twoFactorData.secret,
                encoding: "base32",
                token: String(otp),
                window: 1
            });

            if (!verified) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid authenticator OTP"
                });
            }
        }

        // =====================================================
        // EMAIL OTP
        // =====================================================

        else if (authMethod === "email") {

            if (!twoFactorData.email_otp) {
                return res.status(400).json({
                    success: false,
                    message: "Email OTP not found or already used"
                });
            }

            // -----------------------------------
            // CHECK OTP EXPIRY
            // -----------------------------------

            if (
                !twoFactorData.otp_expires_at ||
                new Date(twoFactorData.otp_expires_at) < new Date()
            ) {

                await User.clearEmailTwoFactorOTP(u_id);

                return res.status(400).json({
                    success: false,
                    message: "Email OTP has expired"
                });
            }

            // -----------------------------------
            // HASH ENTERED OTP
            // -----------------------------------

            const otpHash = crypto
                .createHash("sha256")
                .update(String(otp))
                .digest("hex");

            // -----------------------------------
            // COMPARE OTP
            // -----------------------------------

            if (otpHash !== twoFactorData.email_otp) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid email OTP"
                });
            }
        }

        // =====================================================
        // INVALID METHOD
        // =====================================================

        else {

            return res.status(400).json({
                success: false,
                message: "Invalid 2FA authentication method"
            });
        }

        // -----------------------------------
        // ENABLE 2FA
        // -----------------------------------

        const enabled = await User.enableTwoFactor(u_id);

        if (!enabled) {

            return res.status(500).json({
                success: false,
                message: "Unable to enable two-factor authentication"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Two-factor authentication enabled successfully"
        });

    } catch (error) {

        console.error(
            "Error verifying 2FA:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getActiveDevices = async (req, res) => {
    try {
        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        const sessions = await LoginSession.getActiveSessions(u_id);

        // Format date and time in IST
        const formatDateTime = (date) => {
            if (!date) return null;

            return new Date(date).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        };

        const formattedSessions = sessions.map(session => ({
            ...session,

            created_at: formatDateTime(session.created_at),

            last_activity_at: formatDateTime(
                session.last_activity_at
            ),

            expires_at: formatDateTime(
                session.expires_at
            )
        }));

        return res.status(200).json({
            success: true,
            data: formattedSessions
        });

    } catch (error) {
        console.error("Error fetching active devices:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

/*--------------------------------------------------------------
    Logout Single Device
--------------------------------------------------------------*/
const logoutDevice = async (req, res) => {
    try {

        const u_id = req.user?.userId;
        const { session_id } = req.body;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: "session_id is required"
            });
        }

        const result = await LoginSession.deactivateSession(
            u_id,
            session_id
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Active session not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Device logged out successfully"
        });

    } catch (error) {
        console.error("Logout device error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const logoutAllDevices = async (req, res) => {
    try {

        // -----------------------------------
        // GET LOGGED-IN USER
        // -----------------------------------

        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        // -----------------------------------
        // GET CURRENT JWT TOKEN
        // -----------------------------------

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required"
            });
        }

        const session_token = authHeader.split(" ")[1];

        // -----------------------------------
        // FIND CURRENT SESSION
        // -----------------------------------

        const currentSession =
            await LoginSession.getSessionByToken(
                u_id,
                session_token
            );

        if (!currentSession) {
            return res.status(404).json({
                success: false,
                message: "Current session not found"
            });
        }

        // -----------------------------------
        // LOGOUT ALL OTHER DEVICES
        // -----------------------------------

        const result =
            await LoginSession.deactivateAllOtherSessions(
                u_id,
                currentSession.id
            );

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "All other devices have been logged out successfully"
        });

    } catch (error) {

        console.error(
            "Logout all devices error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

/*--------------------------------------------------------------
    Get Last 5 Login Activities
--------------------------------------------------------------*/
const getLoginActivity = async (req, res) => {
    try {

        const u_id = req.user?.userId;

        if (!u_id) {
            return res.status(401).json({
                success: false,
                message: "User information not found in token"
            });
        }

        const activities =
            await LoginActivity.getLastFiveLoginActivities(u_id);

        // Format date and time in IST
        const formatDateTime = (date) => {
            if (!date) return null;

            return new Date(date).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        };

        const formattedActivities = activities.map(activity => ({
            id: activity.id,
            city: activity.city,
            country: activity.country,
            device: activity.device,
            browser: activity.browser,
            operating_system: activity.operating_system,
            ip_address: activity.ip_address,
            login_type: activity.login_type === 1
                ? "Password Login"
                : activity.login_type === 2
                    ? "Two-Factor Authentication Login"
                    : "Unknown",

            login_status: activity.login_status === 1
                ? "Success"
                : activity.login_status === 0
                    ? "Failed"
                    : "Unknown",
            login_at: formatDateTime(activity.login_at)
        }));

        return res.status(200).json({
            success: true,
            message: "Login activity fetched successfully",
            data: formattedActivities
        });

    } catch (error) {

        console.error(
            "Error fetching login activity:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
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
    verifyTwoFactorLogin,
    
    getUserDetail,
    uploadProfilePhoto,
    update_UserData,
    changePassword,
    forgotPassword,
    resetPassword,

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
    FetchFunction,

    getTwoFactorStatus,
    setupTwoFactor,
    verifyTwoFactor,
    getActiveDevices,
    logoutDevice,
    logoutAllDevices,
    getLoginActivity,
};