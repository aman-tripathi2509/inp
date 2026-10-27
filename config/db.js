require("dotenv").config(); // Load environment variables
const mysql = require("mysql2/promise");

// Create connection pool with promise support
const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});



module.exports = connection;