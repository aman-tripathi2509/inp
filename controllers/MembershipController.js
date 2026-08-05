const bcrypt = require("bcryptjs");
const SignupRequestModel = require("../models/MembershipModel");
const UserModel = require("../models/userModel");
const db = require("../config/db");

// Get all signup requests
const getSignupRequests = async (req, res) => {
    try {

        // ================= DEBUG =================
        console.log("\n========== CONTROLLER DEBUG ==========");
        console.log("Request Body:", req.body);
        console.log("======================================\n");
        // =========================================

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        const filters = {
            full_name: req.body.full_name || "",
            linkedin: req.body.linkedin || "",
            status:
                req.body.status !== undefined &&
                req.body.status !== ""
                    ? parseInt(req.body.status)
                    : "",
            start_date: req.body.start_date || "",
            end_date: req.body.end_date || ""
        };

        // ================= DEBUG =================
        console.log("Filters Created:", filters);
        // =========================================

        const result = await SignupRequestModel.FetchSignupRequest(
            page,
            limit,
            filters
        );

        if (!result.data || result.data.length === 0) {
            return res.status(200).json({
                message: "No Data found",
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                },
            });
        }

        return res.status(200).json({
            message: "Data fetched successfully",
            ...result,
        });

    } catch (error) {
        console.error("Controller Error:", error);

        return res.status(500).json({
            message: "Database error",
            error: error.message,
        });
    }
};


const approve_membership = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                message: "ID is required in request body"
            });
        }

        //--------------------------------------------------
        // Step 1: Approve signup request
        //--------------------------------------------------
        const result = await SignupRequestModel.ApproveMembership(id);

        if (!result.success) {
            return res.status(404).json({
                message: result.message
            });
        }

        //--------------------------------------------------
        // Step 2: Fetch signup request details
        //--------------------------------------------------
        const [rows] = await db.query(
            `
            SELECT
                full_name,
                email
            FROM signup_request
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Signup request not found"
            });
        }

        const { full_name, email } = rows[0];

        //--------------------------------------------------
        // Step 3: Check if user already exists
        //--------------------------------------------------
        const existingUser = await UserModel.getUserByEmail(email);

        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({
                message: "User with this email already exists"
            });
        }

        //--------------------------------------------------
        // Step 4: Generate default password
        //--------------------------------------------------
        const firstName = full_name.trim().split(/\s+/)[0];
        const defaultPassword = `${firstName}123`;

        //--------------------------------------------------
        // Step 5: Create user
        // createUser() will encrypt the password internally
        //--------------------------------------------------
        await UserModel.createUser(
            full_name,
            email,
            defaultPassword
        );

        //--------------------------------------------------
        // Step 6: Response
        //--------------------------------------------------
        return res.status(200).json({
            success: true,
            message: "Signup request approved and user created successfully",
            defaultPassword
        });

    } catch (error) {
        console.error("Error approving signup request:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const reject_request = async (req, res) => {
    try {
        const { id, rejection_reason } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID is required in request body" });
        }

        if (!rejection_reason || rejection_reason.trim() === "") {
            return res.status(400).json({ message: "Rejection reason is required" });
        }

        // Step 1: Check current status
        const [rows] = await db.query(
            "SELECT status FROM signup_request WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Signup request not found" });
        }

        if (rows[0].status === 2) {
            return res.status(400).json({ message: "Signup request is already rejected" });
        }

        // Step 2: Update status to rejected
        const result = await SignupRequestModel.RejectMembership(id, rejection_reason);

        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }

        return res.status(200).json({
            message: result.message
        });
    } catch (error) {
        console.error("Error rejecting signup request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getSignupRequests,
    approve_membership,
    reject_request
};
