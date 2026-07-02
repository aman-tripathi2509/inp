const express = require("express");
const userRoutes = require("../routes/userRoutes");
const adminuserRoutes = require("../routes/adminuserRoutes");
const surveyRoutes = require("../routes/surveyRoutes"); // Import survey routes
const companyRoutes=require("../routes/companyRoutes");
const admincompanyRoutes=require("../routes/adminCompanyRoutes");
const signupRequestRoutes=require("../routes/SignupRequestRoutes");
const contactRoutes=require("../routes/contactRoutes");
const globalRoutes = require('../routes/globalRoutes');
module.exports = function (app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Mount user routes with `/api` base path
    app.use("/api/user", userRoutes);
    app.use("/api/adminuser", adminuserRoutes);
    app.use("/api/company",companyRoutes);//API to fetch the company-details and user_details in searching.
    app.use("/api/adminCompany",admincompanyRoutes);
    app.use("/api/SignupRequest",signupRequestRoutes);
    app.use("/api/survey", surveyRoutes); // Mount survey routes with `/api/survey` base path
    app.use('/api/contact_us',contactRoutes);//api to for contact-us.
    app.use("/api/global", globalRoutes);
};
 