const express = require("express");
const router = express.Router();
const referController =require("../controllers/referController");
const { authMiddleware } = require("../middlewares/authMiddleware"); 
router.post('/', authMiddleware, referController);

module.exports=router;