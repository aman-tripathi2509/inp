const express = require("express");
const router = express.Router();
const { getTransactionList,getTransactionsByMember,getTransactionByTransactionId} = require("../controllers/TransactionController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Get Signup Requests
router.post("/transaction-list", authMiddleware, getTransactionList);
router.post("/getTransactionsByMember", authMiddleware, getTransactionsByMember);
router.post("/getTransactionByTransactionId", authMiddleware, getTransactionByTransactionId);



module.exports = router;
