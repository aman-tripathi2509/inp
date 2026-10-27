const SignupRequestModel = require("../models/MembershipModel");
const UserModel = require("../models/userModel");
const db = require("../config/db");
const crypto = require("crypto");
const PasswordSetupModel = require("../models/PasswordSetupModel");
const sendEmail = require("../utils/emailService");

const fs = require("fs");
const path = require("path");

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
                success: false,
                message: "ID is required in request body"
            });
        }

        // --------------------------------------------------
        // STEP 1: Fetch signup request
        // --------------------------------------------------

        const [rows] = await db.query(
            `
            SELECT 
                full_name,
                email,
                status
            FROM signup_request
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Signup request not found"
            });
        }

        const {
            full_name,
            email,
            status
        } = rows[0];

        if (status === 1) {
            return res.status(400).json({
                success: false,
                message: "Signup request is already approved"
            });
        }

        if (status === 2) {
            return res.status(400).json({
                success: false,
                message: "Signup request is already rejected"
            });
        }

        // --------------------------------------------------
        // STEP 2: Check if user already exists
        // --------------------------------------------------

        const existingUser = await UserModel.getUserByEmail(email);

        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "User with this email already exists"
            });
        }



        // --------------------------------------------------
        // STEP 4: Create user
        // --------------------------------------------------

        const newUser = await UserModel.createApprovedUser(
            full_name,
            email
        );


        // --------------------------------------------------
        // STEP 5: Generate password setup token
        // --------------------------------------------------

        const rawToken = crypto
            .randomBytes(32)
            .toString("hex");


        // --------------------------------------------------
        // STEP 6: Hash token before saving
        // --------------------------------------------------

        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");


        // --------------------------------------------------
        // STEP 7: Token expiry = 24 hours
        // --------------------------------------------------

        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );


        // --------------------------------------------------
        // STEP 8: Save password setup token
        // --------------------------------------------------

        await PasswordSetupModel.createPasswordSetupToken(
            newUser.member_id,
            email,
            tokenHash,
            expiresAt
        );

        const setupPasswordUrl =
        `${process.env.FRONTEND_URL}/set-password?token=${rawToken}`;
    
        const templatePath = path.join(
            __dirname,
            "../email-templates/profile-approved.html"
        );
        
        let emailContent = fs.readFileSync(templatePath, "utf8");
        
        emailContent = emailContent
            .replace(/{{asset_base_url}}/g, process.env.BASE_URL)
            .replace(/{{full_name}}/g, full_name)
            .replace(/{{setupPasswordUrl}}/g, setupPasswordUrl)
            .replace(/{{support_email}}/g, process.env.SUPPORT_EMAIL || "")
            .replace(/{{privacy_link}}/g, `${process.env.FRONTEND_URL}/privacy`)
            .replace(/{{unsubscribe_link}}/g, `${process.env.FRONTEND_URL}/unsubscribe`);
        
        const emailResult = await sendEmail({
            to: email,
            subject: "Your Industry & People Membership Has Been Approved",
            content: emailContent
        });

        if (!emailResult || !emailResult.status) {
            return res.status(500).json({
                success: false,
                message: "Membership approved but password setup email could not be sent"
            });
        }


        // --------------------------------------------------
        // STEP 9: Approve signup request
        // --------------------------------------------------

        const result =
            await SignupRequestModel.ApproveMembership(id);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }


        // --------------------------------------------------
        // STEP 10: Success response
        // --------------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Membership approved and password setup email sent successfully",
            member_id: newUser.member_id
        });

    } catch (error) {

    console.error(
        "========== APPROVE MEMBERSHIP ERROR =========="
    );

    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
    });
}
};

const reject_request = async (req, res) => {
    try {

        const {
            id,
            rejection_reason
        } = req.body;

        // -----------------------------------
        // VALIDATION
        // -----------------------------------

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required in request body"
            });
        }

        if (
            !rejection_reason ||
            rejection_reason.trim() === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required"
            });
        }

        // -----------------------------------
        // FETCH SIGNUP REQUEST
        // -----------------------------------

        const [rows] = await db.query(
            `
            SELECT
                full_name,
                email,
                status
            FROM signup_request
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Signup request not found"
            });
        }

        const {
            full_name,
            email,
            status
        } = rows[0];

        // -----------------------------------
        // CHECK STATUS
        // -----------------------------------

        if (status === 2) {
            return res.status(400).json({
                success: false,
                message: "Signup request is already rejected"
            });
        }

        if (status === 1) {
            return res.status(400).json({
                success: false,
                message: "Signup request is already approved"
            });
        }

        // -----------------------------------
        // UPDATE STATUS
        // -----------------------------------

        const result =
            await SignupRequestModel.RejectMembership(
                id,
                rejection_reason
            );

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        // -----------------------------------
        // SEND REJECTION EMAIL
        // -----------------------------------

        const emailResult = await sendEmail({
            to: email,
            subject: "Membership Request Update",
            content: `
                <div style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: auto;
                ">

                    <h2 style="color: #333;">
                        Membership Request Update
                    </h2>

                    <p>
                        Dear ${full_name},
                    </p>

                    <p>
                        Thank you for your interest in
                        <strong>Industry & People</strong>.
                    </p>

                    <p>
                        We have carefully reviewed your membership
                        request. Unfortunately, we are unable to
                        proceed with your membership request at this
                        time.
                    </p>

                    <p>
                        <strong>Reason for rejection:</strong>
                    </p>

                    <div style="
                        background:#f5f5f5;
                        border-left:4px solid #d9534f;
                        padding:15px;
                        margin:15px 0;
                    ">
                        ${rejection_reason}
                    </div>

                    <p>
                        We appreciate the time and effort you took to
                        submit your request.
                    </p>

                    <p>
                        If you believe you have additional information
                        that may be relevant, you may contact our team
                        for further clarification.
                    </p>

                    <p>
                        Thank you for your understanding.
                    </p>

                    <p>
                        Regards,<br>
                        <strong>Industry & People Team</strong>
                    </p>

                </div>
            `
        });

        // -----------------------------------
        // CHECK EMAIL RESULT
        // -----------------------------------

        if (!emailResult || !emailResult.status) {

            console.error(
                "Membership rejected but rejection email failed:",
                emailResult
            );

            return res.status(200).json({
                success: true,
                email_sent: false,
                message:
                    "Membership rejected successfully, but rejection email could not be sent"
            });
        }

        // -----------------------------------
        // SUCCESS
        // -----------------------------------

        return res.status(200).json({
            success: true,
            email_sent: true,
            message:
                "Membership rejected and rejection email sent successfully"
        });

    } catch (error) {

        console.error(
            "Error rejecting signup request:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    getSignupRequests,
    approve_membership,
    reject_request
};
