const db = require("../config/db");

// Fetch all signup requests with pagination and filters
const FetchSignupRequest = async (page = 1, limit = 15, filters = {}) => {
    try {
        const offset = (page - 1) * limit;
        let whereClauses = [];
        let params = [];

        // Status filter
        if (filters.status !== "" && filters.status !== undefined && filters.status !== null) {
            whereClauses.push("status = ?");
            params.push(filters.status);
        } else {
            // Default: Pending + Rejected
            whereClauses.push("status IN (0, 2)");
        }

        // Name filter
        if (filters.full_name) {
            whereClauses.push("full_name LIKE ?");
            params.push(`%${filters.full_name}%`);
        }

        // LinkedIn filter
        if (filters.linkedin) {
            whereClauses.push("linkedin LIKE ?");
            params.push(`%${filters.linkedin}%`);
        }

        // Date range filter
        if (filters.start_date && filters.end_date) {
            whereClauses.push("DATE(created_at) BETWEEN ? AND ?");
            params.push(filters.start_date, filters.end_date);
        }

        const whereSql =
            whereClauses.length > 0
                ? `WHERE ${whereClauses.join(" AND ")}`
                : "";

        const sql = `
            SELECT
                id,
                full_name,
                email,
                linkedin,
                status,
                created_at
            FROM signup_request
            ${whereSql}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `;

        const queryParams = [...params, limit, offset];

        // ================= DEBUG =================
        console.log("\n========== MODEL DEBUG ==========");
        console.log("Filters:", filters);
        console.log("Where SQL:", whereSql);
        console.log("Params:", params);
        console.log("Query Params:", queryParams);
        console.log("SQL:", sql);
        console.log("=================================\n");
        // =========================================

        const [rows] = await db.query(sql, queryParams);

        console.log("Rows Returned:", rows);

        const formattedRows = rows.map(row => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            linkedin: row.linkedin,
            status:
                row.status === 0
                    ? "Pending"
                    : row.status === 2
                    ? "Rejected"
                    : "Approved",
            created_at: row.created_at.toISOString().split("T")[0]
        }));

        const countSql = `
            SELECT COUNT(*) AS total
            FROM signup_request
            ${whereSql}
        `;

        const [countRows] = await db.query(countSql, params);

        return {
            data: formattedRows,
            pagination: {
                total: countRows[0].total,
                page,
                limit,
                totalPages: Math.ceil(countRows[0].total / limit),
            },
        };
    } catch (error) {
        console.error("Model Error:", error);
        throw error;
    }
};



const ApproveMembership = async (id) => {
    try {
        const sql = `
            UPDATE signup_request 
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

const RejectMembership = async (id, rejection_reason) => {
    try {
        const sql = `
            UPDATE signup_request 
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
    ApproveMembership,
    RejectMembership
};
