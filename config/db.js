require("dotenv").config(); // Load environment variables
const mysql = require("mysql2/promise");

// Create connection pool with promise support
const connection = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "+05:30" // ✅ Set to Indian Standard Time
});



module.exports = connection;