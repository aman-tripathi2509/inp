require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./config/db");
const setupSwagger = require("./startup/swagger");

const app = express();

// ✅ ONLY keep these
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// test API
app.get("/users", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM users where id=1");
        res.json(results);
    } catch (err) {
        return res.status(500).json({ error: "Database error" });
    }
});

setupSwagger(app);
require("./startup/routes")(app);

const PORT = process.env.PORT || 5000;

async function startServer() {
    let connection;

    try {
        connection = await db.getConnection();
        console.log("Connected to the database.");
    } catch (err) {
        console.error("Database connection failed:", err);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
