require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const db = require("./config/db");
const setupSwagger = require("./startup/swagger");

const { initializeSocket } = require("./socket");

const app = express();

const server = http.createServer(app);

initializeSocket(server);

app.set("trust proxy", true);

app.use(cors({
    origin: [
        "https://ipadmintest.irbureau.com",
        "https://iptest.irbureau.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "public", "uploads"))
);

app.use(
    "/email-assets",
    express.static(path.join(__dirname, "public", "email-assets"))
);

app.get("/test", (req, res) => {
    res.send("this is just test API");
});

app.get("/users", async (req, res) => {
    try {
        const [results] = await db.query(
            "SELECT * FROM users WHERE id = ?",
            [1]
        );
        res.json(results);
    } catch (err) {
        console.error("❌ DB Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

require("./config/db");
setupSwagger(app);
require("./startup/routes")(app);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

server.listen(PORT, () => {
    console.log(`Server running on https://${HOST}:${PORT}`);
});