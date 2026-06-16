const bcrypt = require("bcryptjs");
const SignupRequestModel = require("../models/SignupRequestModel");
const UserModel = require("../models/userModel");
const db = require("../config/db");

// Get all signup requests
const getSignupRequests = async (req, res) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;

        const filters = {
            full_name: req.body.full_name || "", // updated from username
            email: req.body.email || "",
            status: req.body.status || "",       // dropdown 0,1,2
            start_date: req.body.start_date || "",
            end_date: req.body.end_date || ""
        };

        const result = await SignupRequestModel.FetchSignupRequest(page, limit, filters);

        if (!result.data || result.data.length === 0) {
            return res.status(200).json({
                message: "No signup requests found",
                data: [],
                pagination: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                },
            });
        }

        res.status(200).json({
            message: "Signup requests fetched successfully",
            ...result,
        });
    } catch (error) {
        console.error("Error fetching signup requests:", error);
        res.status(500).json({
            message: "Database error",
            error: error.message,
        });
    }
};


const ApproveRequest = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: "ID is required in request body" });
        }

        // Step 1: Approve signup request (update status)
        const result = await SignupRequestModel.ApproveSignupRequest(id);

        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }

        // Step 2: Fetch approved user's data
        const [rows] = await db.query(
            `SELECT full_name, email FROM inp_signup_request WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Signup request not found" });
        }

        const { full_name, email } = rows[0];

        // Step 3: Check if user already exists by email
        const existingUser = await UserModel.getUserByEmail(email);
        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({
                message: "User with this email already exists in the system"
            });
        }

        // Step 4: Extract first name from full_name
        const firstName = full_name.trim().split(/\s+/)[0];

        // Step 5: Generate default password (first_name + 123)
        const defaultPassword = `${firstName}123`;

        // Step 6: Hash the default password
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        // Step 7: Insert user into user_demographic_details
        await UserModel.createUser(full_name, email, hashedPassword);

        return res.status(200).json({
            message: "Signup request approved and user data inserted successfully",
            defaultPassword: defaultPassword // optional for admin visibility
        });
    } catch (error) {
        console.error("Error approving signup request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const RejectRequest = async (req, res) => {
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
            "SELECT status FROM inp_signup_request WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Signup request not found" });
        }

        if (rows[0].status === 2) {
            return res.status(400).json({ message: "Signup request is already rejected" });
        }

        // Step 2: Update status to rejected
        const result = await SignupRequestModel.RejectSignupRequest(id, rejection_reason);

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
    ApproveRequest,
    RejectRequest
};
