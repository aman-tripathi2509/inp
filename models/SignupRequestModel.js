const db = require("../config/db");

// Fetch all signup requests with pagination and filters
const FetchSignupRequest = async (page = 1, limit = 15, filters = {}) => {
    try {
        const offset = (page - 1) * limit;
        let whereClauses = [];
        let params = [];

        // Status filter (dropdown)
        if (filters.status !== "" && filters.status !== undefined) {
            whereClauses.push("status = ?");
            params.push(filters.status);
        } else {
            // Default: only pending
            whereClauses.push("status = 0");
        }

        // Optional filters
        if (filters.full_name) {
            whereClauses.push("full_name LIKE ?");
            params.push(`%${filters.full_name}%`);
        }

        if (filters.email) {
            whereClauses.push("email LIKE ?");
            params.push(`%${filters.email}%`);
        }

        // Date range filter
        if (filters.start_date && filters.end_date) {
            whereClauses.push("DATE(created_at) BETWEEN ? AND ?");
            params.push(filters.start_date, filters.end_date);
        }

        // Construct WHERE clause
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        // Main query — select required columns
        const sql = `
            SELECT id, full_name, email, status, created_at
            FROM inp_signup_request
            ${whereSql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        // Format created_at and map status
        const formattedRows = rows.map(row => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            status: row.status === 0 ? "Pending" : row.status === 1 ? "Approved" : "Rejected",
            created_at: row.created_at.toISOString().split('T')[0] // YYYY-MM-DD
        }));

        // Count total records for pagination
        const [countRows] = await db.query(
            `SELECT COUNT(*) as total FROM inp_signup_request ${whereSql}`,
            params.slice(0, -2)
        );

        const total = countRows[0]?.total || 0;

        return {
            data: formattedRows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        throw error;
    }
};



const ApproveSignupRequest = async (id) => {
    try {
        const sql = `
            UPDATE inp_signup_request 
            SET status = 1, updated_at = NOW() 
            WHERE id = ?
        `;
        const [result] = await db.query(sql, [id]);
        if (result.affectedRows === 0) {
            return {
                success: false,
                message: "ID not found"
            };
        }
        return {
            success: true,
            message: "Status Changed successfully"
        };
    } catch (error) {
        console.error("Error updating status:", error);
        throw error;
    }
};

const RejectSignupRequest = async (id, rejection_reason) => {
    try {
        const sql = `
            UPDATE inp_signup_request 
            SET status = 2, rejection_reason = ?, updated_at = NOW() 
            WHERE id = ?
        `;
        const [result] = await db.query(sql, [rejection_reason, id]);

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: "ID not found"
            };
        }

        return {
            success: true,
            message: "Signup request rejected successfully"
        };
    } catch (error) {
        console.error("Error updating rejection status:", error);
        throw error;
    }
};


module.exports = {
    FetchSignupRequest,
    ApproveSignupRequest,
    RejectSignupRequest
};
