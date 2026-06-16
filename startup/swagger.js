const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");  //  Add CORS

// Load Swagger JSON file
const swaggerFile = path.join(__dirname, "swagger.json");
const swaggerData = fs.readFileSync(swaggerFile, "utf8");
const swaggerDocument = JSON.parse(swaggerData);

const setupSwagger = (app) => {

    // Use CORS middleware
    app.use(cors());
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("Swagger docs available at http://localhost:5000/api-docs");
};

module.exports = setupSwagger;
