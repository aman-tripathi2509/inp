const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { aesEncrypt, aesDecrypt } = require("../utils/encryption");
const sendEmail = require("../utils/emailService");
const Wallet = require("../models/walletModel");

dotenv.config();

async function getWallet(req, res) {

    try {

        const member_id = req.user.member_id;

        const wallet = await Wallet.getWallet(member_id);

        if (!wallet.status) {

            return res.status(404).json({

                status: false,

                message: wallet.message

            });

        }

        return res.status(200).json({

            status: true,

            message: "Wallet fetched successfully.",

            data: wallet.data

        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({

            status: false,

            message: "Internal Server Error."

        });

    }

}

async function getTransactionHistory(req, res) {

    try {

        const member_id = req.user.member_id;

        const filters = {

            member_id,

            page: parseInt(req.body.page) || 1,

            limit: parseInt(req.body.limit) || 10,

            transaction_type: parseInt(req.body.transaction_type) || 0,

            date_filter: parseInt(req.body.date_filter) || 0,

            from_date: req.body.from_date || null,

            to_date: req.body.to_date || null

        };

        const result = await Wallet.getTransactionHistory(filters);

        return res.status(200).json({
            status: true,
            message: "Transaction history fetched successfully.",
            data: result
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });

    }

}

module.exports = {

    getWallet,
    getTransactionHistory

};