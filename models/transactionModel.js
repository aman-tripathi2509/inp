const db = require("../config/db");

const fetchTransactionList = async (filters = {}, page = 1, limit = 15) => {
    try {
        const offset = (page - 1) * limit;

        // --- Destructure filters
        const {
            member_id,
            start_date,
            end_date,
            payment_method,
            transaction_type,
            status,
        } = filters;

        // --- Base query and params
        let whereClauses = [];
        let params = [];

        // Apply filters dynamically
        if (member_id) {
            whereClauses.push("t.member_id = ?");
            params.push(member_id);
        }

        if (payment_method) {
            whereClauses.push("t.payment_method = ?");
            params.push(payment_method);
        }

        if (transaction_type) {
            whereClauses.push("t.transaction_type = ?");
            params.push(transaction_type);
        }

        if (status) {
            // Convert string status to numeric
            let statusValue = status.toLowerCase() === "success" ? 1 :
                              status.toLowerCase() === "failed" ? 0 : 2;
            whereClauses.push("t.status = ?");
            params.push(statusValue);
        }

        if (start_date && end_date) {
            whereClauses.push("DATE(t.transaction_date) BETWEEN ? AND ?");
            params.push(start_date, end_date);
        } else if (start_date) {
            whereClauses.push("DATE(t.transaction_date) >= ?");
            params.push(start_date);
        } else if (end_date) {
            whereClauses.push("DATE(t.transaction_date) <= ?");
            params.push(end_date);
        }

        // Combine all WHERE conditions
        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

        // --- Main query (Paginated)
        const sql = `
            SELECT 
                t.id,
                t.member_id,
                CONCAT_WS(' ',
                    TRIM(u.first_name),
                    NULLIF(TRIM(u.middle_name), ''),
                    TRIM(u.last_name)
                ) AS full_name,
                t.transaction_id,
                t.payment_method,
                DATE_FORMAT(t.transaction_date, '%Y-%m-%d %H:%i:%s') AS transaction_date,
                t.transaction_type,
                t.amount,
                t.status,
                t.note,
                t.balance_amount
            FROM inp_transaction t
            LEFT JOIN user_demographic_details u 
                ON t.member_id = u.member_id
            ${whereSQL}
            ORDER BY t.id DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(sql, [...params, limit, offset]);

        // --- Format results
        const formattedRows = rows.map(row => ({
            id: row.id,
            member_id: row.member_id,
            full_name: row.full_name?.trim() || "",
            transaction_id: row.transaction_id,
            payment_method: row.payment_method,
            transaction_date: row.transaction_date,
            transaction_type: row.transaction_type,
            amount: row.amount,
            status:
                row.status === 0
                    ? "failed"
                    : row.status === 1
                    ? "success"
                    : "pending",
            note: row.note,
            balance_amount: row.balance_amount,
        }));

        // --- Count total records for pagination
        const countSql = `
            SELECT COUNT(*) AS total 
            FROM inp_transaction t
            LEFT JOIN user_demographic_details u ON t.member_id = u.member_id
            ${whereSQL}
        `;
        const [countRows] = await db.query(countSql, params);
        const total = countRows[0]?.total || 0;

        return {
            message: "Transactions fetched successfully",
            data: formattedRows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
    }
};

const fetchTransactionsByMemberId = async (
    member_id,
    page = 1,
    limit = 15,
    filters = {}
) => {
    try {
        if (!member_id) {
            throw new Error("member_id is required");
        }

        const offset = (page - 1) * limit;

        // --- Build WHERE conditions dynamically
        let whereClause = "WHERE t.member_id = ?";
        const params = [member_id];

        if (filters.transaction_id) {
            whereClause += " AND t.transaction_id LIKE ?";
            params.push(`%${filters.transaction_id}%`);
        }

        if (filters.start_date && filters.end_date) {
            whereClause += " AND DATE(t.transaction_date) BETWEEN ? AND ?";
            params.push(filters.start_date, filters.end_date);
        } else if (filters.start_date) {
            whereClause += " AND DATE(t.transaction_date) >= ?";
            params.push(filters.start_date);
        } else if (filters.end_date) {
            whereClause += " AND DATE(t.transaction_date) <= ?";
            params.push(filters.end_date);
        }

        if (filters.payment_method) {
            whereClause += " AND t.payment_method = ?";
            params.push(filters.payment_method);
        }

        if (filters.transaction_type) {
            whereClause += " AND t.transaction_type = ?";
            params.push(filters.transaction_type);
        }

        if (filters.status !== undefined && filters.status !== "") {
            whereClause += " AND t.status = ?";
            params.push(filters.status);
        }

        // --- Query transactions with filters
        const sql = `
            SELECT 
                t.id,
                t.member_id,
                CONCAT_WS(' ',
                    TRIM(u.first_name),
                    NULLIF(TRIM(u.middle_name), ''),
                    TRIM(u.last_name)
                ) AS full_name,
                t.transaction_id,
                t.payment_method,
                DATE_FORMAT(t.transaction_date, '%Y-%m-%d %H:%i:%s') AS transaction_date,
                t.transaction_type,
                t.amount,
                t.status,
                t.note
            FROM inp_transaction t
            LEFT JOIN user_demographic_details u 
                ON t.member_id = u.member_id
            ${whereClause}
            ORDER BY t.id DESC
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        // --- Format results with correct status mapping
        const formattedRows = rows.map(row => ({
            id: row.id,
            member_id: row.member_id,
            full_name: row.full_name?.trim() || "",
            transaction_id: row.transaction_id,
            payment_method: row.payment_method,
            transaction_date: row.transaction_date,
            transaction_type: row.transaction_type,
            amount: row.amount,
            status:
                row.status === 0
                    ? "failed"
                    : row.status === 1
                    ? "success"
                    : "pending",
            note: row.note,
        }));

        // --- Get latest balance
        const balanceSql = `
            SELECT balance_amount 
            FROM inp_transaction 
            WHERE member_id = ? 
            ORDER BY id DESC 
            LIMIT 1
        `;
        const [balanceRow] = await db.query(balanceSql, [member_id]);
        const latestBalance = balanceRow[0]?.balance_amount || 0;

        // --- Get total credit & debit
        const totalSql = `
            SELECT 
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS total_credit,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS total_debit
            FROM inp_transaction
            WHERE member_id = ?
        `;
        const [totalRow] = await db.query(totalSql, [member_id]);
        const totalCredit = totalRow[0]?.total_credit || 0;
        const totalDebit = totalRow[0]?.total_debit || 0;

        // --- Count total for pagination
        const countSql = `
            SELECT COUNT(*) AS total 
            FROM inp_transaction t
            ${whereClause}
        `;
        const [countRows] = await db.query(countSql, params.slice(0, -2)); // exclude LIMIT & OFFSET
        const total = countRows[0]?.total || 0;

        return {
            message: "Transactions for member fetched successfully",
            data: formattedRows,
            balance: latestBalance,
            total_credit: totalCredit,
            total_debit: totalDebit,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        console.error("Error fetching member transactions:", error);
        throw error;
    }
};


const fetchTransactionByTransactionId = async (transaction_id) => {
    try {
        const sql = `
            SELECT 
                t.id,
                t.member_id,
                CONCAT_WS(' ',
                    TRIM(u.first_name),
                    NULLIF(TRIM(u.middle_name), ''),
                    TRIM(u.last_name)
                ) AS full_name,
                t.transaction_id,
                t.payment_method,
                DATE_FORMAT(t.transaction_date, '%Y-%m-%d %H:%i:%s') AS transaction_date,
                t.transaction_type,
                t.amount,
                t.status,
                t.note,
                t.balance_amount
            FROM inp_transaction t
            LEFT JOIN user_demographic_details u 
                ON t.member_id = u.member_id
            WHERE t.transaction_id = ?
            LIMIT 1
        `;

        const [rows] = await db.query(sql, [transaction_id]);

        if (!rows.length) {
            return null;
        }

        const row = rows[0];

        // Format status text
        const formatted = {
            id: row.id,
            member_id: row.member_id,
            full_name: row.full_name?.trim() || "",
            transaction_id: row.transaction_id,
            payment_method: row.payment_method,
            transaction_date: row.transaction_date,
            transaction_type: row.transaction_type,
            amount: row.amount,
            status:
                row.status === 0
                    ? "failed"
                    : row.status === 1
                    ? "success"
                    : "pending",
            note: row.note,
            balance_amount: row.balance_amount,
        };

        return formatted;
    } catch (error) {
        console.error("Error fetching transaction by ID:", error);
        throw error;
    }
};


module.exports = { fetchTransactionList, fetchTransactionsByMemberId, fetchTransactionByTransactionId };
