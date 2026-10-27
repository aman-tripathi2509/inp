const bcrypt = require("bcryptjs");
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
const PasswordSetupModel = require("../models/PasswordSetupModel");

const loadEmailTemplate = require("../utils/emailTemplate");

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

        const baseUrl = process.env.BASE_URL;

        const filteredUser = {
            id: user[0].id,
            member_id: user[0].member_id,
        
            first_name: user[0].first_name || "",
            middle_name: user[0].middle_name || "",
            last_name: user[0].last_name || "",
        
            profile_photo: user[0].profile_photo || null,
        
            profile_photo_url: user[0].profile_photo
                ? `${baseUrl}${user[0].profile_photo}`
                : null
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

        const params = { ...req.body };

        if (!params || Object.keys(params).length === 0) {
            return res.status(400).json({
                message: "Bad update request"
            });
        }

        // -----------------------------------
        // CALCULATE YEAR OF BIRTH + AGE
        // FROM DOB
        // -----------------------------------

        if (params.dob) {

            let dobDate;

            // -----------------------------------
            // SUPPORT YYYY-MM-DD
            // -----------------------------------

            if (/^\d{4}-\d{2}-\d{2}$/.test(params.dob)) {

                const [year, month, day] =
                    params.dob.split("-").map(Number);

                // Use local date to avoid timezone issues
                dobDate = new Date(
                    year,
                    month - 1,
                    day
                );

            }

            // -----------------------------------
            // SUPPORT DD-MM-YYYY
            // -----------------------------------

            else if (/^\d{2}-\d{2}-\d{4}$/.test(params.dob)) {

                const [day, month, year] =
                    params.dob.split("-").map(Number);

                dobDate = new Date(
                    year,
                    month - 1,
                    day
                );

            }

            else {

                return res.status(400).json({
                    message: "Invalid DOB format. Use YYYY-MM-DD or DD-MM-YYYY"
                });

            }

            // -----------------------------------
            // VALIDATE DOB
            // -----------------------------------

            if (isNaN(dobDate.getTime())) {

                return res.status(400).json({
                    message: "Invalid date of birth"
                });

            }

            const today = new Date();

            if (dobDate > today) {

                return res.status(400).json({
                    message: "Date of birth cannot be in the future"
                });

            }

            // -----------------------------------
            // YEAR OF BIRTH
            // -----------------------------------

            const yearOfBirth = dobDate.getFullYear();

            // -----------------------------------
            // CALCULATE AGE
            // -----------------------------------

            let age =
                today.getFullYear() -
                dobDate.getFullYear();

            const hasBirthdayOccurred =
                today.getMonth() > dobDate.getMonth() ||
                (
                    today.getMonth() === dobDate.getMonth() &&
                    today.getDate() >= dobDate.getDate()
                );

            if (!hasBirthdayOccurred) {
                age--;
            }

            // -----------------------------------
            // ADD CALCULATED VALUES
            // -----------------------------------

            params.year_of_birth = yearOfBirth;
            params.age_entered = age;
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

// Update user data for logged-in user
// const updateUser = async (req, res) => {
//     try {
//         const token = req.headers.authorization?.split(" ")[1];
//         if (!token) {
//             return res.status(401).json({ message: "No token provided" });
//         }

//         // Verify JWT token
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         const userId = decoded.userId;

//         // Fetch current user data
//         const user = await User.getUserById(userId);
//         if (!user || user.length === 0) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         // Get update fields from request body
//         const {
//             name,
//             personal_email,
//             work_email,
//             mobile,
//             dob,
//             gender,
//             zip_code,
//             country,
//             state,
//             enter_city,
//             highest_education,
//             household_income,
//             mailing_address,
//             skills,
//             work_status,
//             employement_status,
//             profession_type,
//             job_title,
//             current_company,
//             company_url,
//             work_experience,
//             seniority_level,
//             job_responsibilities,
//             work_experience_current_company,
//             sector,
//             industry,
//             business_model,
//             company_revenue,
//             company_type,
//             employee_size,
//             headquarter,
//             company_linkedin_url,
//             specialities,
//             about_product_and_services,
//             about_user,
//             twitter,
//             instagram,
//             facebook,
//             linkedin,
//             previous_employment
//         } = req.body;

//         // Debug: Log the previous_employment field to verify it's received
//         console.log("Previous employment received:", previous_employment);

//         // Validate personal_email if provided
//         if (personal_email) {
//             const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//             if (!emailRegex.test(personal_email)) {
//                 return res.status(400).json({ message: "Invalid personal email format" });
//             }
//         }

//         // Validate previous_employment if provided
// if (previous_employment) {
//     if (!Array.isArray(previous_employment)) {
//         return res.status(400).json({ message: "Previous employment must be an array" });
//     }

//     for (const employment of previous_employment) {
//         // Validate date fields only if they exist
//         const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//         if (employment.start_date && !dateRegex.test(employment.start_date)) {
//             return res.status(400).json({ message: "Invalid start_date format in previous employment (use YYYY-MM-DD)" });
//         }
//         if (employment.end_date && !dateRegex.test(employment.end_date)) {
//             return res.status(400).json({ message: "Invalid end_date format in previous employment (use YYYY-MM-DD)" });
//         }
//     }
// }


//         // Handle name splitting
//         let updateData = {
//             personal_email,
//             work_email,
//             mobile,
//             dob,
//             gender,
//             zip_code,
//             country,
//             state,
//             enter_city,
//             highest_education,
//             household_income,
//             mailing_address,
//             skills,
//             work_status,
//             employement_status,
//             profession_type,
//             job_title,
//             current_company,
//             company_url,
//             work_experience,
//             seniority_level,
//             job_responsibilities,
//             work_experience_current_company,
//             sector,
//             industry,
//             business_model,
//             company_revenue,
//             company_type,
//             employee_size,
//             headquarter,
//             company_linkedin_url,
//             specialities,
//             about_product_and_services,
//             about_user,
//             twitter,
//             instagram,
//             facebook,
//             linkedin,
//             previous_employment,
//             updated_on: new Date() // Set current timestamp
//         };

//         if (name) {
//             const nameParts = name.trim().split(/\s+/);
//             if (nameParts.length === 1) {
//                 updateData.first_name = nameParts[0];
//             } else if (nameParts.length === 2) {
//                 updateData.first_name = nameParts[0];
//                 updateData.last_name = nameParts[1];
//             } else {
//                 updateData.first_name = nameParts[0];
//                 updateData.middle_name = nameParts[1];
//                 updateData.last_name = nameParts.slice(2).join(' ');
//             }
//         }

//         // Remove undefined or null fields
//         updateData = Object.fromEntries(
//             Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null)
//         );

//         // Debug: Log updateData to verify previous_employment is included
//         console.log("Update data:", updateData);

//         if (Object.keys(updateData).length === 0) {
//             return res.status(400).json({ message: "No fields provided to update" });
//         }

//         // Call model to update user
//         const result = await User.updateUser(userId, updateData);

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: "User not found or no changes made" });
//         }

//         // Fetch updated user data
//         const updatedUser = await User.getUserById(userId);

//         res.status(200).json({
//             message: "User data updated successfully",
//             user: updatedUser[0]
//         });
//     } catch (error) {
//         console.error("Error in updateUser:", error);
//         if (error.name === "JsonWebTokenError") {
//             return res.status(401).json({ message: "Invalid token" });
//         }
//         if (error.message === "No fields provided to update") {
//             return res.status(400).json({ message: "No fields provided to update" });
//         }
//         res.status(500).json({ message: "Database error" });
//     }
// };

//  async function updateUserData(req, res){
// try{
//   //const memberID=req.body.member_id;
//   const params =req.body;
//   if(!params || Object.keys(params).length === 0){
//     return res.status(400).json({message:"Bad update request"});
//   }
//   const data= await User.updateUserData(params); 
   
//   if(data.affectedRows==0){
//     return res.status(200).json({message: "No such member_id exist"});
//   }
//     return res.status(200).json({message: "data is updated successfully!"});
   
   
// }
// catch(err){
//     console.log("error in updating the data in user table: ",err.message);
//     return res.status(500).json({message:"internal server error"});
// }
// }

// const fetchUserDetails= async(req,res)=>{
//   try{
//     const fetchData= await User.fetchAllUserData();
   
//       return res.status(200).json({message:"user data from user_demographic_details",fetchData});
//   }
//   catch(err){
//     return res.status(500).json({message:"internal server error"})
//   }
// }

// Get single user by member_id
// const getINPUserById = async (req, res) => {
//     try {
//         const { member_id } = req.body; // <-- from body
//         const user = await User.InpUserById(member_id);

//         if (!user || user.length === 0) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         res.status(200).json({
//             message: "User fetched successfully",
//             data: user[0],
//         });
//     } catch (error) {
//         console.error("Error fetching user:", error);
//         res.status(500).json({ message: "Database error", error: error.message });
//     }
// };

// New controller to fetch employees by company
// const getCompanyEmployees = async (req, res) => {
//     try {
//         const { company_id } = req.body; // Expecting company_id in request body

//         if (!company_id) {
//             return res.status(400).json({ 
//                 message: "Company ID is required in request body" 
//             });
//         }

//         // Optional: Validate company_id format (assuming it's a string or number)
//         if (typeof company_id !== 'string' && typeof company_id !== 'number') {
//             return res.status(400).json({ 
//                 message: "Invalid company ID format" 
//             });
//         }

//         const employees = await User.getEmployeesByCompany(company_id);

//         if (!employees || employees.length === 0) {
//             return res.status(200).json({ 
//                 message: "No employees found for this company",
//                 employees: [],
//                 company_id: company_id
//             });
//         }

//         res.status(200).json({
//             message: "Employees fetched successfully",
//             company_id: company_id,
//             employees: employees,
//             total_employees: employees.length
//         });

//     } catch (error) {
//         console.error("Error in getCompanyEmployees:", error);
        
//         if (error.message === "Company ID is required") {
//             return res.status(400).json({ message: error.message });
//         }
        
//         res.status(500).json({ 
//             message: "Internal server error while fetching company employees",
//             error: error.message 
//         });
//     }
// };

// ====================== GET ALL COMPANIES ======================
// const GetAllInpUsers = async (req, res) => {
//     try {
//         const filters = {
//             member_id: req.body.member_id || null,
//             name: req.body.name || null,
//             location: req.body.location || null,   // Open-ended location
//             Job_title: req.body.Job_title || null,
//             sector: req.body.sector || null,
//             industry: req.body.industry || null,
//             global_search: req.body.global_search || null // Global search
//         };
//         const page = parseInt(req.body.page) || 1;
//         const limit = parseInt(req.body.limit) || 15;
//         // ✅ Check if any filter is applied
//         const activeFilters = Object.values(filters).filter(v => v !== null && v !== '');
//         if (activeFilters.length === 0) {
//             return res.status(400).json({
//                 message: "Please apply at least one search filter to view users.",
//                 error: "No filters provided"
//             });
//         }
//         // Fetch data
//         const result = await User.AllINPUserListing(filters, page, limit);
//         res.status(200).json({
//             message: "Users fetched successfully",
//             totalRecords: result.totalRecords,
//             totalPages: result.totalPages,
//             currentPage: result.currentPage,
//             data: result.data
//         });
//     } catch (error) {
//         console.error("Error fetching Users:", error);
//         res.status(500).json({ message: "Database error", error: error.message });
//     }
// };


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
        // PASSWORD RESET COOLDOWN
        // -----------------------------------
        
        const recentRequest =
        await PasswordResetModel.getRecentPasswordResetRequest(
            userEmail
        );
    
        if (
            recentRequest &&
            recentRequest.elapsed_seconds !== null &&
            recentRequest.elapsed_seconds < 60
        ) {
        
            const remainingSeconds =
                60 - Number(recentRequest.elapsed_seconds);
        
            return res.status(429).json({
                success: false,
                message:
                    `Please wait ${remainingSeconds} seconds before requesting another password reset.`
            });
        }
        
        
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
            `${process.env.FRONTEND_URL}/set-password?token=${encodeURIComponent(rawToken)}`;

        // -----------------------------------
        // LOAD PASSWORD RESET TEMPLATE
        // -----------------------------------

        const firstName =
            userData.first_name ||
            userData.name ||
            "User";

        const emailHtml = loadEmailTemplate(
            "password-reset.html",
            {
                asset_base_url:
                    process.env.BASE_URL,

                first_name:
                    firstName,

                reset_link:
                    resetUrl,

                reset_link_expiry:
                    "30 minutes",

                unsubscribe_link:
                    process.env.UNSUBSCRIBE_LINK || "#",

                support_email:
                    process.env.SUPPORT_EMAIL ||
                    "support@industryandpeople.com",

                privacy_link:
                    process.env.PRIVACY_LINK || "#",

                india_address:
                    process.env.INDIA_ADDRESS || "",

                united_states_address:
                    process.env.UNITED_STATES_ADDRESS || "",

                united_kingdom_address:
                    process.env.UNITED_KINGDOM_ADDRESS || ""
            }
        );

        // -----------------------------------
        // SEND EMAIL
        // -----------------------------------

        const emailResult = await sendEmail({
            to: userEmail,
            subject: "Reset Your Password",
            content: emailHtml
        });
        
        console.log(
            "PASSWORD RESET EMAIL RESULT:",
            JSON.stringify(emailResult, null, 2)
        );

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


const requestPasswordResetOTP = async (req, res) => {
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
                message:
                    "Token, new password and confirm password are required"
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message:
                    "New password and confirm password do not match"
            });
        }

        // -----------------------------------
        // HASH RESET TOKEN
        // -----------------------------------

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // -----------------------------------
        // CHECK RESET TOKEN
        // -----------------------------------

        let tokenData = null;
        let tokenType = null;

        tokenData =
            await PasswordResetModel.getValidPasswordResetToken(
                tokenHash
            );

        if (tokenData) {

            tokenType = "reset";

        } else {

            // -----------------------------------
            // CHECK FIRST-TIME SETUP TOKEN
            // -----------------------------------

            tokenData =
                await PasswordSetupModel.getValidPasswordSetupToken(
                    tokenHash
                );

            if (tokenData) {
                tokenType = "setup";
            }
        }


        // -----------------------------------
        // INVALID TOKEN
        // -----------------------------------

        if (!tokenData) {

            return res.status(400).json({
                success: false,
                message: "Invalid or expired password link"
            });
        }
        
        // -----------------------------------
        // OTP RESEND COOLDOWN - 60 SECONDS
        // -----------------------------------
        
        if (
            tokenData.otp_elapsed_seconds !== null &&
            Number(tokenData.otp_elapsed_seconds) < 60
        ) {
        
            const remainingSeconds =
                60 - Number(tokenData.otp_elapsed_seconds);
        
            return res.status(429).json({
                success: false,
                message:
                    `Please wait ${remainingSeconds} seconds before requesting another OTP.`
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
        // OTP EXPIRY - 10 MINUTES
        // -----------------------------------

        const otpExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // -----------------------------------
        // ENCRYPT NEW PASSWORD
        // -----------------------------------

        const encryptedPassword = aesEncrypt(
            new_password
        );


        // -----------------------------------
        // SAVE ENCRYPTED PASSWORD
        // -----------------------------------

        if (tokenType === "reset") {

            await PasswordResetModel.savePendingPasswordHash(
                tokenData.id,
                encryptedPassword
            );

        } else if (tokenType === "setup") {

            await PasswordSetupModel.savePendingPasswordHash(
                tokenData.id,
                encryptedPassword
            );
        }

        // -----------------------------------
        // SAVE OTP
        // -----------------------------------

        if (tokenType === "reset") {

            await PasswordResetModel.savePasswordResetOTP(
                tokenData.id,
                otpHash,
                otpExpiresAt
            );

        } else if (tokenType === "setup") {

            await PasswordSetupModel.savePasswordSetupOTP(
                tokenData.id,
                otpHash,
                otpExpiresAt
            );
        }

        // -----------------------------------
        // SEND OTP EMAIL
        // -----------------------------------

        const firstName =
            tokenData.first_name ||
            tokenData.name ||
            "User";

        const emailHtml = `
            <div style="font-family: Arial, sans-serif;">
                <h2>Password Reset Verification</h2>

                <p>Hello ${firstName},</p>

                <p>
                    We received a request to reset your password.
                </p>

                <p>
                    Your verification OTP is:
                </p>

                <h1 style="letter-spacing: 8px;">
                    ${otp}
                </h1>

                <p>
                    This OTP will expire in <strong>10 minutes</strong>.
                </p>

                <p>
                    If you did not request a password reset,
                    please ignore this email.
                </p>
            </div>
        `;

        const emailResult = await sendEmail({
            to: tokenData.email,
            subject: "Password Reset Verification OTP",
            content: emailHtml
        });

        // -----------------------------------
        // EMAIL FAILED
        // -----------------------------------

        if (!emailResult || !emailResult.status) {

            console.error(
                "Password reset OTP email failed:",
                emailResult
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to send verification OTP"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message:
                "Verification OTP has been sent to your registered email"
        });

    } catch (error) {

        console.error(
            "Error requesting password reset OTP:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const verifyPasswordResetOTP = async (req, res) => {
    try {

        const { token, otp } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!token || !otp) {
            return res.status(400).json({
                success: false,
                message: "Token and OTP are required"
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits"
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
        // CHECK RESET / SETUP TOKEN
        // -----------------------------------

        let tokenData = null;
        let tokenType = null;

        // First check password reset token
        tokenData =
            await PasswordResetModel.getValidPasswordResetToken(
                tokenHash
            );

        if (tokenData) {

            tokenType = "reset";

        } else {

            // -----------------------------------
            // CHECK FIRST-TIME PASSWORD SETUP TOKEN
            // -----------------------------------

            tokenData =
                await PasswordSetupModel.getValidPasswordSetupToken(
                    tokenHash
                );

            if (tokenData) {
                tokenType = "setup";
            }
        }

        // -----------------------------------
        // INVALID TOKEN
        // -----------------------------------

        if (!tokenData) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired password link"
            });
        }

        // -----------------------------------
        // GET OTP DATA
        // -----------------------------------

        let otpData = null;

        if (tokenType === "reset") {

            otpData =
                await PasswordResetModel.getValidPasswordResetOTP(
                    tokenData.id
                );

        } else if (tokenType === "setup") {

            otpData =
                await PasswordSetupModel.getValidPasswordSetupOTP(
                    tokenData.id
                );
        }

        // -----------------------------------
        // OTP NOT REQUESTED
        // -----------------------------------

        if (!otpData || !otpData.otp_hash) {
            return res.status(400).json({
                success: false,
                message: "OTP has not been requested"
            });
        }

        // -----------------------------------
        // CHECK OTP ATTEMPTS
        // -----------------------------------

        if (otpData.otp_attempts >= 5) {
            return res.status(400).json({
                success: false,
                message: "Too many incorrect OTP attempts"
            });
        }

        // -----------------------------------
        // CHECK OTP EXPIRY
        // -----------------------------------

        if (
            !otpData.otp_expires_at ||
            new Date(otpData.otp_expires_at) < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired"
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
        // VERIFY OTP
        // -----------------------------------

        if (otpHash !== otpData.otp_hash) {

            if (tokenType === "reset") {

                await PasswordResetModel.incrementOTPAttempts(
                    tokenData.id
                );

            } else if (tokenType === "setup") {

                await PasswordSetupModel.incrementOTPAttempts(
                    tokenData.id
                );
            }

            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // -----------------------------------
        // CHECK PENDING PASSWORD
        // -----------------------------------

        if (!otpData.pending_password_hash) {
            return res.status(400).json({
                success: false,
                message: "Password setup session not found"
            });
        }

        // -----------------------------------
        // UPDATE ACTUAL PASSWORD
        // -----------------------------------

        const result = await User.setPasswordFromEncryptedValue(
            otpData.member_id,
            otpData.pending_password_hash
        );

        if (!result || result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to update password"
            });
        }

        // -----------------------------------
        // MARK OTP VERIFIED
        // -----------------------------------

        if (tokenType === "reset") {

            await PasswordResetModel.markPasswordResetOTPVerified(
                tokenData.id
            );

        } else if (tokenType === "setup") {

            await PasswordSetupModel.markPasswordSetupOTPVerified(
                tokenData.id
            );
        }

        // -----------------------------------
        // MARK TOKEN USED
        // -----------------------------------

        if (tokenType === "reset") {

            await PasswordResetModel.markPasswordResetTokenUsed(
                tokenData.id
            );

        } else if (tokenType === "setup") {

            await PasswordSetupModel.markTokenUsed(
                tokenData.id
            );
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Password updated successfully. You can now login."
        });

    } catch (error) {

        console.error(
            "Error verifying password reset OTP:",
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
        // BASIC VALIDATION
        // -----------------------------------

        if (!token || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Token, new password and confirm password are required"
            });
        }

        // -----------------------------------
        // CONFIRM PASSWORD VALIDATION
        // -----------------------------------

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        // -----------------------------------
        // PASSWORD VALIDATION
        // Same rules as signup API
        // -----------------------------------

        const passwordRegex =
            /^(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,}$/;

        if (!passwordRegex.test(new_password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter and 1 special character."
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
        // CHECK PASSWORD RESET TOKEN
        // -----------------------------------

        let tokenData = null;
        let tokenType = null;

        tokenData =
            await PasswordResetModel.getValidPasswordResetToken(
                tokenHash
            );

        if (tokenData) {
            tokenType = "reset";
        } else {
            // -----------------------------------
            // CHECK FIRST-TIME SETUP TOKEN
            // -----------------------------------

            tokenData =
                await PasswordSetupModel.getValidPasswordSetupToken(
                    tokenHash
                );

            if (tokenData) {
                tokenType = "setup";
            }
        }

        // -----------------------------------
        // INVALID / EXPIRED TOKEN
        // -----------------------------------

        if (!tokenData) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired password link"
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
                message: "Unable to update password"
            });
        }

        // -----------------------------------
        // MARK TOKEN AS USED
        // -----------------------------------

        if (tokenType === "reset") {
            await PasswordResetModel.markPasswordResetTokenUsed(
                tokenData.id
            );
        } else if (tokenType === "setup") {
            await PasswordSetupModel.markTokenUsed(
                tokenData.id
            );
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Password updated successfully. You can now login."
        });

    } catch (error) {
        console.error(
            "Error setting/resetting password:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/**
 * Controller to fetch highest education answers
 */
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

/**
 * Controller to fetch Work Status answers
 */
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

/**
 * Controller to fetch Primary profession answers
 */
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

        if (
            country_id === undefined ||
            country_id === null ||
            country_id === ""
        ) {
            return res.status(400).json({
                message: "country_id is required in request body"
            });
        }

        let countryIds;

        if (Array.isArray(country_id)) {
            countryIds = country_id.map(Number);
        } else {
            countryIds = [Number(country_id)];
        }

        // Validate country IDs
        if (
            countryIds.length === 0 ||
            countryIds.some(
                id => !Number.isInteger(id) || id <= 0
            )
        ) {
            return res.status(400).json({
                message: "Invalid country_id"
            });
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

/**
 * Controller to fetch Total Work Ex
 */
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

/**
 * Controller to fetch Seniority Level
 */
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

/**
 * Controller to fetch Total Work Ex
 */
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

/**
 * Controller to fetch Business Model
 */
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

/**
 * Controller to fetch Company Type
 */
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
/**
 * Controller to fetch Company Type
 */
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
/**
 * Controller to fetch Company Type
 */
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
/**
 * Controller to fetch Company Type
 */
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
/**
 * Controller to fetch Department
 */
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
/**
 * Controller to fetch Functions by Department
 * Pass department ID in req.body as { "department's question_answer_id": 1 }
 */
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

        // -----------------------------------
        // NAME VALIDATION
        // -----------------------------------

        const trimmedName = name.trim();

        // Name can contain alphabets and spaces only
        const nameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;

        if (!nameRegex.test(trimmedName)) {
            return res.status(400).json({
                message: "Name can contain alphabets and spaces only."
            });
        }

        // Split name into first, middle and last names
        const nameParts = trimmedName.split(/\s+/);

        const firstName = nameParts[0] || "";

        const middleName = nameParts.length > 2
            ? nameParts.slice(1, -1).join(" ")
            : "";

        const lastName = nameParts.length > 1
            ? nameParts[nameParts.length - 1]
            : "";

        // Maximum 55 characters for each name part
        if (firstName.length > 55) {
            return res.status(400).json({
                message: "First name cannot exceed 55 characters."
            });
        }

        if (middleName.length > 55) {
            return res.status(400).json({
                message: "Middle name cannot exceed 55 characters."
            });
        }

        if (lastName.length > 55) {
            return res.status(400).json({
                message: "Last name cannot exceed 55 characters."
            });
        }

        // -----------------------------------
        // EMAIL VALIDATION
        // -----------------------------------

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                message: "Invalid email address."
            });
        }

        // -----------------------------------
        // PASSWORD VALIDATION
        // -----------------------------------

        const passwordRegex =
            /^(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter and 1 special character."
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

        const verificationToken = jwt.sign(
            {
                userId: newUser.insertId,
                purpose: "EMAIL_VERIFICATION"
            },
                process.env.JWT_SECRET,
            {
                expiresIn: "24h"
            }
        );

        const verificationLink =
        `${process.env.BASE_URL}/api/user/verify-email?token=${encodeURIComponent(verificationToken)}`;

        // -----------------------------------
        // SEND EMAIL VERIFICATION EMAIL
        // -----------------------------------

        try {
            const firstName = name.trim().split(/\s+/)[0];

            // DEBUG ENV VALUES
            console.log("EMAIL ENV CHECK:");
            console.log("APP_URL:", process.env.APP_URL);
            console.log("INDIA_ADDRESS:", process.env.INDIA_ADDRESS);
            console.log("UNITED_STATES_ADDRESS:", process.env.UNITED_STATES_ADDRESS);
            console.log("UNITED_KINGDOM_ADDRESS:", process.env.UNITED_KINGDOM_ADDRESS);


            const emailHtml = loadEmailTemplate(
                "welcome-referral.html",
                {
                    asset_base_url: process.env.BASE_URL,

                    first_name: firstName,

                    verification_link: verificationLink,

                    unsubscribe_link:
                        process.env.UNSUBSCRIBE_LINK || "#",

                    support_email:
                        process.env.SUPPORT_EMAIL ||
                        "support@industryandpeople.com",

                    privacy_link:
                        process.env.PRIVACY_LINK || "#",

                    india_address:
                        process.env.INDIA_ADDRESS || "",

                    united_states_address:
                        process.env.UNITED_STATES_ADDRESS || "",

                    united_kingdom_address:
                        process.env.UNITED_KINGDOM_ADDRESS || ""
                }
            );

            const emailResult = await sendEmail({
                to: email,
                subject: "Welcome to Industry & People",
                content: emailHtml
            });

            console.log(
                "Verification email sent:",
                emailResult
            );

        } catch (emailError) {

            console.error(
                "Failed to send verification email:",
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

            let emailResult;

            try {

                emailResult = await sendEmail({
                    to: personalEmail,
                    subject: "Your Two-Factor Authentication OTP",
                    content: `
                        <div style="
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: auto;
                        ">

                            <h2>
                                Two-Factor Authentication
                            </h2>

                            <p>
                                Hello ${userData.first_name || "User"},
                            </p>

                            <p>
                                Use the following verification code
                                to enable Two-Factor Authentication:
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
                                If you did not request this,
                                please ignore this email.
                            </p>

                            <p>
                                Regards,<br>
                                <strong>Industry & People Team</strong>
                            </p>

                        </div>
                    `
                });

                // -----------------------------------
                // LOG EMAIL RESULT
                // -----------------------------------

                console.log(
                    "2FA EMAIL RESULT:",
                    emailResult
                );

            } catch (emailError) {

                // -----------------------------------
                // EMAIL API ERROR
                // -----------------------------------

                console.error(
                    "2FA EMAIL ERROR:",
                    emailError
                );

                // Clear OTP because email failed
                await User.clearEmailTwoFactorOTP(u_id);

                return res.status(500).json({
                    success: false,
                    message: "Unable to send OTP email",
                    error: emailError.message
                });
            }

            // -----------------------------------
            // CHECK EMAIL RESULT
            // -----------------------------------

            if (!emailResult || !emailResult.status) {

                console.error(
                    "2FA EMAIL FAILED RESPONSE:",
                    emailResult
                );

                // Clear OTP because email failed
                await User.clearEmailTwoFactorOTP(u_id);

                return res.status(500).json({
                    success: false,
                    message: "Unable to send OTP email",
                    email_result: emailResult || null
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

        // -----------------------------------
        // GENERAL ERROR
        // -----------------------------------

        console.error(
            "Error setting up 2FA:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
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



/*--------------------------------------------------------------
    Send OTP to Disable 2FA
--------------------------------------------------------------*/
const disableTwoFactorOTP = async (req, res) => {
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
        // GET 2FA STATUS
        // -----------------------------------

        const status = await User.getTwoFactorStatus(u_id);

        if (!status.exists || !status.is_enabled) {
            return res.status(400).json({
                success: false,
                message: "Two-factor authentication is not enabled"
            });
        }

        // -----------------------------------
        // ONLY EMAIL 2FA NEEDS OTP REQUEST
        // -----------------------------------

        if (status.auth_method !== "email") {
            return res.status(400).json({
                success: false,
                message:
                    "OTP request is only required for email two-factor authentication"
            });
        }

        // -----------------------------------
        // GET MEMBER ID
        // -----------------------------------

        const member_id = req.user?.member_id;

        if (!member_id) {
            return res.status(401).json({
                success: false,
                message: "Member information not found in token"
            });
        }

        // -----------------------------------
        // GET USER DETAILS
        // -----------------------------------

        const user = await User.getLoggedinUser(member_id);

        if (!user || user.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userData = user[0];

        // -----------------------------------
        // DECRYPT EMAIL
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

        // -----------------------------------
        // GENERATE OTP
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
        // OTP EXPIRES IN 5 MINUTES
        // -----------------------------------

        const otpExpiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // -----------------------------------
        // SAVE OTP
        // -----------------------------------

        const result = await User.createDisableTwoFactorOTP(
            u_id,
            otpHash,
            otpExpiresAt
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: "Unable to generate disable 2FA OTP"
            });
        }

        // -----------------------------------
        // SEND EMAIL
        // -----------------------------------

        const emailResult = await sendEmail({
            to: personalEmail,
            subject: "Your Disable Two-Factor Authentication OTP",
            content: `
                <div style="font-family: Arial, sans-serif;">

                    <h2>Disable Two-Factor Authentication</h2>

                    <p>
                        Hello ${userData.first_name || "User"},
                    </p>

                    <p>
                        You requested to disable Two-Factor
                        Authentication on your account.
                    </p>

                    <p>
                        Use the following verification code:
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
                        If you did not request this, please
                        secure your account immediately.
                    </p>

                </div>
            `
        });

        // -----------------------------------
        // EMAIL FAILED
        // -----------------------------------

        if (!emailResult.status) {

            await User.clearEmailTwoFactorOTP(u_id);

            return res.status(500).json({
                success: false,
                message: "Unable to send OTP email"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your registered email"
        });

    } catch (error) {

        console.error(
            "Error sending disable 2FA OTP:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/*--------------------------------------------------------------
    Disable 2FA
--------------------------------------------------------------*/
const disableTwoFactor = async (req, res) => {
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
            return res.status(404).json({
                success: false,
                message: "2FA setup not found"
            });
        }

        const twoFactorData = result.data;

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
        // AUTHENTICATOR APP
        // =====================================================

        if (twoFactorData.auth_method === "authenticator") {

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

        else if (twoFactorData.auth_method === "email") {

            if (!twoFactorData.email_otp) {
                return res.status(400).json({
                    success: false,
                    message: "Disable 2FA OTP not found or expired"
                });
            }

            // -----------------------------------
            // CHECK EXPIRY
            // -----------------------------------

            if (
                !twoFactorData.otp_expires_at ||
                new Date(twoFactorData.otp_expires_at) < new Date()
            ) {

                await User.clearEmailTwoFactorOTP(u_id);

                return res.status(400).json({
                    success: false,
                    message: "Disable 2FA OTP has expired"
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
                    message: "Invalid disable 2FA OTP"
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
        // DISABLE 2FA
        // -----------------------------------

        const disabled = await User.disableTwoFactor(u_id);

        if (!disabled) {
            return res.status(500).json({
                success: false,
                message: "Unable to disable two-factor authentication"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            message: "Two-factor authentication disabled successfully"
        });

    } catch (error) {

        console.error(
            "Error disabling 2FA:",
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


const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send("Verification token is required");
        }

        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(400).send("Verification link is invalid or expired");
        }

        // Make sure this token is specifically for email verification
        if (decoded.purpose !== "EMAIL_VERIFICATION") {
            return res.status(400).send("Invalid verification token");
        }

        if (!decoded.userId) {
            return res.status(400).send("Invalid verification token");
        }

        const result = await User.verifyUserEmail(decoded.userId);

        if (result.affectedRows === 0) {
            return res.send(`
                <h2>Email Already Verified</h2>
                <p>Your Industry & People email has already been verified.</p>
            `);
        }

        return res.send(`
            <h2>Email Verified Successfully</h2>
            <p>Your Industry & People account email has been successfully verified.</p>
            <p>You can now continue to your account.</p>
        `);

    } catch (error) {
        console.error("Email verification error:", error);

        return res.status(500).send(
            "Unable to verify email"
        );
    }
};


/*--------------------------------------------------------------
    Fetch Skills API
--------------------------------------------------------------*/
const getAllSkills = async (req, res) => {
    try {
        const search = String(req.query.search || "");

        const skills = await User.getAllSkills(search);

        return res.status(200).json({
            success: true,
            message: "Skills fetched successfully",
            total: skills.length,
            data: skills
        });

    } catch (error) {
        console.error("Fetch skills error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// Export the function separately
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
    requestPasswordResetOTP,
    verifyPasswordResetOTP,
    resetPassword,
    
    HighestEducation,
    getStates,
    WorkStatus,
    PrimaryProfession,
    TotalWorkEx,
    SeniorityLevel,
    WorkExCurrentCompany,
    BusinessModel,
    CompanyType,
    FetchYears,
    FetchHouseholdIncome,
    FetchEmployementStatus,
    FetchDepartment,
    FetchFunction,
    
    
    getTwoFactorStatus,
    setupTwoFactor,
    verifyTwoFactor,
    disableTwoFactorOTP,
    disableTwoFactor,
    getActiveDevices,
    logoutDevice,
    logoutAllDevices,
    getLoginActivity,
    
    verifyEmail,
    getAllSkills
};
