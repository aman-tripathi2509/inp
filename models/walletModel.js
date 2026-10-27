const db = require("../config/db");
const { aesEncrypt } = require("../utils/encryption");
const crypto = require("crypto");

async function getWallet(member_id) {

    try {

        const walletSql = `
            SELECT
                wallet_id,
                balance
            FROM inp_wallet
            WHERE member_id = ?
            LIMIT 1
        `;

        const [wallet] = await db.query(walletSql, [member_id]);

        if (wallet.length === 0) {

            return {
                status: false,
                message: "Wallet not found."
            };

        }

        return {

            status: true,

            data: {

                wallet: wallet[0]

            }

        };

    } catch (error) {

        throw error;

    }

}


async function getTransactionHistory(filters) {

    try {

        const {

            member_id,

            page,

            limit,

            transaction_type,

            date_filter,

            from_date,

            to_date

        } = filters;

        const offset = (page - 1) * limit;

        let where = " WHERE wt.member_id = ? ";

        let params = [member_id];

        /*-------------------------------------------------------
            TRANSACTION TYPE
        -------------------------------------------------------*/

        switch (transaction_type) {

            case 1: // Earned

                where += `
                    AND wt.transaction_type_id IN (1,2,3,6,8)
                `;

                break;

            case 2: // Spend

                where += `
                    AND wt.transaction_type_id IN (7,9,10)
                `;

                break;

            case 3: // Withdraw

                where += `
                    AND wt.transaction_type_id = 5
                `;

                break;

            case 4: // Purchased

                where += `
                    AND wt.transaction_type_id = 4
                `;

                break;

            default:
                break;

        }

        /*-------------------------------------------------------
            DATE FILTER
        -------------------------------------------------------*/

        switch (date_filter) {

            case 1: // Last 24 Hours

                where += " AND wt.created_on >= NOW() - INTERVAL 1 DAY ";

                break;

            case 2: // Last 7 Days

                where += " AND wt.created_on >= NOW() - INTERVAL 7 DAY ";

                break;

            case 3: // Last 28 Days

                where += " AND wt.created_on >= NOW() - INTERVAL 28 DAY ";

                break;

            case 4: // Custom Date

                if (from_date && to_date) {

                    where += " AND DATE(wt.created_on) BETWEEN ? AND ? ";

                    params.push(from_date);

                    params.push(to_date);

                }

                break;

            default:
                break;

        }

        /*-------------------------------------------------------
            COUNT
        -------------------------------------------------------*/

        const countSql = `

            SELECT COUNT(*) AS total

            FROM inp_wallet_transactions wt

            ${where}

        `;

        const [count] = await db.query(countSql, params);

        /*-------------------------------------------------------
            DATA
        -------------------------------------------------------*/

        const dataSql = `

            SELECT

                wt.transaction_id,

                wt.transaction_type_id,

                wtt.transaction_name,

                CASE
                    WHEN wt.transaction_type_id IN (1,2,3,6,8) THEN 'Earned'
                    WHEN wt.transaction_type_id IN (7,9,10) THEN 'Spend'
                    WHEN wt.transaction_type_id = 5 THEN 'Withdraw'
                    WHEN wt.transaction_type_id = 4 THEN 'Purchased'
                END AS transaction_type_label,

                wt.transaction_mode,

                wt.coins,

                wt.status,

                DATE_FORMAT(
                    wt.created_on,
                    '%d %b %Y %h:%i %p'
                ) AS created_on

            FROM inp_wallet_transactions wt

            INNER JOIN inp_wallet_transaction_type wtt
                ON wt.transaction_type_id = wtt.transaction_type_id

            ${where}

            ORDER BY wt.transaction_id DESC

            LIMIT ?, ?

        `;

        const dataParams = [...params];

        dataParams.push(offset);

        dataParams.push(limit);

        const [rows] = await db.query(dataSql, dataParams);

        return {

            total_records: count[0].total,

            current_page: page,

            per_page: limit,

            transactions: rows

        };

    } catch (error) {

        throw error;

    }

}


module.exports = {

    getWallet,
    getTransactionHistory

};