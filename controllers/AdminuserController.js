const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const AdminUser = require("../models/adminuserModel");
const path = require("path");
const fs = require("fs");
const { AdminINPUserListing } = require('../models/adminuserModel');

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
            { adminId: admin[0].id },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        res.status(200).json({ message: "Admin login successful", token, admin: admin[0] });
    } catch (error) {
        console.error("Error in admin login:", error);
        res.status(500).json({ message: "Database error" });
    }
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
            country: req.body.country || "",
            current_company: req.body.current_company || "",
            job_title: req.body.job_title || "", // Changed to match case sensitivity
            employee_size: req.body.employee_size || "",
            company_revenue: req.body.company_revenue || "",
            seniority_level: req.body.seniority_level || "",
            profession_type: req.body.profession_type || "",
            sector: req.body.sector || "",
            industry: req.body.industry || ""
        };

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
        const { member_id } = req.body; // <-- from body
        const user = await AdminUser.AdminInpUserById(member_id);

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

// ====================== ADD USER ======================
const AdminAddInpUser = async (req, res) => {
    try {
        const userData = req.body;

        // ✅ Validate required fields
        if (!userData.first_name || !userData.work_email) {
            return res.status(400).json({ message: "first_name and work_email are required" });
        }

        const result = await AdminUser.AdminAddInpUser(userData);

        res.status(201).json({
            message: "User and LinkedIn data added successfully",
            insertId: result.insertId,
            member_id: result.member_id
        });
    } catch (error) {
        console.error("Error adding user:", error);
        if (error.message.includes("already exists")) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: "Database error", error: error.message });
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
    AdminImportInpUsers
 };
