require("dotenv").config();
const express = require("express");
const db = require("./config/db");
const setupSwagger = require("./startup/swagger");

const app = express();

// ✅ ONLY keep these
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// test API
app.get("/users", (req, res) => {
    db.query("SELECT * FROM users where id=1", (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

setupSwagger(app);
require("./startup/routes")(app);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});