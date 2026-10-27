const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const AdminUser = require("../models/adminuserModel");
const path = require("path");
const fs = require("fs");
const { AdminINPUserListing } = require('../models/adminuserModel');
const { aesEncrypt} = require("../utils/encryption");
const LoginSession = require("../models/loginSessionModel");

dotenv.config();

const key = Buffer.from("@!#$%^&*()_+1234"); // same key as CI project

// AES Decrypt function (convert hex → base64 → decrypt)
function aesDecrypt(cipherHex) {
    if (!/^[0-9a-fA-F]+$/.test(cipherHex)) {
        return "";
    }
    const encryptedBase64 = Buffer.from(cipherHex, "hex").toString("base64");
    const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedBase64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ====================== ADMIN LOGIN ======================
const Adminlogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // Find admin from lu_user
        const admin = await AdminUser.AdminloginUser(username);

        if (admin.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Decrypt stored password
        const decryptedPassword = aesDecrypt(admin[0].password);

        if (password !== decryptedPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate JWT
        const token = jwt.sign(
            { adminId: admin[0].user_id },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );
        
        // Create login session
        const expires_at = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );
        
        await LoginSession.createLoginSession({
            u_id: null,
            member_id: null,
            admin_user_id: admin[0].user_id,
            session_token: token,
            ip_address:
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                req.socket?.remoteAddress ||
                req.ip ||
                null,
            user_agent: req.headers["user-agent"] || null,
            device: "Admin",
            browser: null,
            operating_system: null,
            expires_at
        });

        // Prepare response without password
        const adminData = {
            user_id: admin[0].user_id,
            full_name: `${admin[0].first_name} ${admin[0].last_name}`,
            username: admin[0].username
        };

        res.status(200).json({
            message: "Login successful",
            token,
            admin: adminData
        });
    } catch (error) {
        console.error("Error in admin login:", error);
        res.status(500).json({ message: "Database error" });
    }
};


const toArray = (value) => {
    if (!value) return [];

    // Already an array (multiple form-data keys)
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    // Comma-separated string
    return String(value)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
};
// ====================== GET ALL COMPANIES ======================
const AdminGetInpUsers = async (req, res) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        // --- Map filters, ensuring null or empty strings are handled ---
        const filters = {
            member_id: req.body.member_id || "",
            name: req.body.name || "",
            job_title: req.body.job_title || "",

            country: toArray(req.body.country),
            current_company: toArray(req.body.current_company),
            employee_size: toArray(req.body.employee_size),
            company_revenue: toArray(req.body.company_revenue),
            seniority_level: toArray(req.body.seniority_level),
            profession_type: toArray(req.body.profession_type),
            sector: toArray(req.body.sector),
            industry: toArray(req.body.industry),
        };

        console.log("=========== CONTROLLER ===========");
        console.log("Request Body:", req.body);
        console.log("Filters:", filters);

        const users = await AdminINPUserListing(page, limit, filters);

        // --- Handle empty results ---
        if (!users.data || users.data.length === 0) {
            return res.status(200).json({
                message: "No users found",
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                }
            });
        }

        // --- Normal response ---
        res.status(200).json({
            message: "Users fetched successfully",
            ...users
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Database error", error: error.message });
    }
};



// Get single user by member_id
const AdmingetINPUserById = async (req, res) => {
    try {
        const { member_id } = req.body;

        if (!member_id) {
            return res.status(400).json({
                message: "member_id is required"
            });
        }

        const user = await AdminUser.AdminInpUserById(member_id);

        if (!user.length) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const userData = user[0];

        // Decrypt personal email
        userData.personal_email = userData.personal_email
        ? aesDecrypt(userData.personal_email)
        : null;

        userData.work_email = userData.work_email
        ? aesDecrypt(userData.work_email)
        : null;

        userData.mobile = userData.mobile
        ? aesDecrypt(userData.mobile)
        : null;

        return res.status(200).json({
            message: "User fetched successfully",
            data: userData
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Database error",
            error: error.message
        });
    }
};

// ====================== ADD INP USER ======================
const AdminAddInpUser = async (req, res) => {
    try {
        const userData = req.body;

        // Logged-in admin lu_user.user_id from JWT
        const loggedInUserId = req.user?.adminId;

        if (!loggedInUserId) {
            return res.status(401).json({
                message: "Unauthorized user"
            });
        }

        // ================= VALIDATION =================

        if (!userData.first_name) {
            return res.status(400).json({
                message: "first_name is required"
            });
        }

        if (!userData.work_email) {
            return res.status(400).json({
                message: "work_email is required"
            });
        }

        // ================= ENCRYPT =================

        const encryptedPersonalEmail = userData.personal_email
            ? aesEncrypt(userData.personal_email)
            : null;

        const encryptedMobile = userData.mobile
            ? aesEncrypt(userData.mobile)
            : null;

        // ================= PREPARE DATA =================

        const data = {
            ...userData,

            personal_email: userData.personal_email
                ? aesEncrypt(userData.personal_email)
                : null,

            mobile: userData.mobile
                ? aesEncrypt(userData.mobile)
                : null,

            password: userData.password
                ? aesEncrypt(userData.password)
                : null,

            work_email: userData.work_email
            ? aesEncrypt(userData.work_email)
            : null,

            // logged-in lu_user.user_id
            user_id: loggedInUserId
        };

        // ================= MODEL =================

        const result = await AdminUser.AdminAddInpUser(data);

        return res.status(201).json({
            message: "User added successfully",
            data: {
                id: result.insertId,
                member_id: result.member_id
            }
        });

    } catch (error) {

        console.error("Error adding INP user:", error);

        if (error.message.includes("already exists")) {
            return res.status(409).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message: "Database error",
            error: error.message
        });
    }
};


// ====================== UPDATE INP USER ======================
const AdminUpdateInpUser = async (req, res) => {
    try {

        const userData = req.body;

        // Logged-in admin
        const loggedInUserId = req.user?.adminId;

        if (!loggedInUserId) {
            return res.status(401).json({
                message: "Unauthorized user"
            });
        }


        // ================= VALIDATION =================

        if (!userData.member_id) {
            return res.status(400).json({
                message: "member_id is required"
            });
        }

        if (userData.id !== undefined) {
            return res.status(400).json({
                message: "id cannot be updated"
            });
        }


        // ================= PREPARE DATA =================

        const data = {
            ...userData,

            // Only encrypt when field is actually sent
            personal_email:
                userData.personal_email !== undefined
                    ? (
                        userData.personal_email
                            ? aesEncrypt(userData.personal_email)
                            : null
                    )
                    : undefined,

            mobile:
                userData.mobile !== undefined
                    ? (
                        userData.mobile
                            ? aesEncrypt(userData.mobile)
                            : null
                    )
                    : undefined,

            password:
                userData.password !== undefined
                    ? (
                        userData.password
                            ? aesEncrypt(userData.password)
                            : null
                    )
                    : undefined,

            work_email:
                userData.work_email !== undefined
                    ? (
                        userData.work_email
                            ? aesEncrypt(userData.work_email)
                            : null
                    )
                    : undefined,

            // Admin who updated it
            updated_by: loggedInUserId
        };


        // ================= MODEL =================

        const result =
            await AdminUser.AdminUpdateInpUser(data);


        return res.status(200).json({
            message: "User updated successfully",
            data: {
                id: result.id,
                member_id: result.member_id
            }
        });


    } catch (error) {

        console.error(
            "Error updating INP user:",
            error
        );


        if (error.message === "User not found") {

            return res.status(404).json({
                message: "User not found"
            });
        }


        if (error.message.includes("already exists")) {

            return res.status(409).json({
                message: error.message
            });
        }


        return res.status(500).json({
            message: "Database error",
            error: error.message
        });
    }
};

// ====================== USER IMPORT CSV ======================
const AdminImportInpUsers = async (req, res) => {
    let filePath;
    try {
        console.log("Request file:", req.file); // Debug log
        if (!req.file) {
            return res.status(400).json({ message: "No CSV file uploaded" });
        }

        if (!req.file.mimetype.includes("csv")) {
            filePath = path.join(__dirname, "../Uploads", req.file.filename);
            fs.unlinkSync(filePath);
            return res.status(400).json({ message: "Only CSV files are allowed" });
        }

        filePath = path.join(__dirname, "../Uploads", req.file.filename);
        const result = await AdminUser.AdminINPUserImportCSV(filePath);

        // Delete file after processing
        fs.unlinkSync(filePath);

        res.status(200).json({
            message: result.message,
            totalInserted: result.totalInserted,
            failedRows: result.failedRows
        });
    } catch (error) {
        console.error("Error importing CSV:", error);
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.status(500).json({ message: "Failed to import CSV", error: error.message });
    }
};


module.exports = { Adminlogin,
    AdminGetInpUsers,
    AdmingetINPUserById,
    AdminAddInpUser,
    AdminUpdateInpUser,
    AdminImportInpUsers
 };
