const express = require("express");
const router = express.Router();
const { getWallet, getTransactionHistory} = require("../controllers/walletController");  // Import both functions
const { authMiddleware } = require("../middlewares/authMiddleware");  // Import authMiddleware

// Fetch wallet
router.get(
    "/fetch-wallet",
    authMiddleware,
    getWallet
);

router.get(
    "/fetch-transactions",
    authMiddleware,
    getTransactionHistory
);
// Export the router
module.exports = router;
