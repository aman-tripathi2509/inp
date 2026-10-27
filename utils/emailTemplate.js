const fs = require("fs");
const path = require("path");

const loadEmailTemplate = (templateName, variables = {}) => {

    const templatePath = path.join(
        __dirname,
        "..",
        "email-templates",
        templateName
    );

    let html = fs.readFileSync(templatePath, "utf8");

    Object.entries(variables).forEach(([key, value]) => {

        const placeholder = `{{${key}}}`;

        html = html.replace(
            new RegExp(
                placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "g"
            ),
            value ?? ""
        );

    });

    return html;
};

module.exports = loadEmailTemplate;