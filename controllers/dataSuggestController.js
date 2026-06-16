const data = require('../models/dataSuggestModel');


class DataController {
    //get the company_name data:-
     static async getCompanyName(req, res) {
      try {
        const company_name = await data.CompanydataSuggest();
  
        if (company_name && company_name.length > 0) {
          return res.status(200).json({
            message: "Companies name fetched successfully.",
            company_name
          });
        }
  
        return res.status(204).json({
          message: "No data found",
          company_name: []
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }

    // get the employees data:-
    static async getEmployees(req, res) {
        try {
          const employees = await data.EmployeedataSuggest();
    
          if (employees && employees.length > 0) {
            return res.status(200).json({
              message: "Employee data fetched successfully.",
              question_id:11,
              employees
            });
          }
    
          return res.status(204).json({
            message: "No data found",
            employees: []
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      }

      //get the revenue data:-
      static async getRevenue(req, res) {
        try {
          const revenue = await data.RevenuedataSuggest();
    
          if (revenue && revenue.length > 0) {
            return res.status(200).json({
              message: "Revenue data fetched successfully.",
              question_id:12,
              revenue
            });
          }
    
          return res.status(204).json({
            message: "No data found",
            revenue: []
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      }

      // to fetch the work status data :-
     static async workController(req,res){
      try{
         const result= await data.workStatus();
         if(result && result.length>0){
          return res.status(200).json({message : "work status data is fetched successfully",
            question_id:1, result});
         }
         return res.status(404).json({message:"No data found", result });
      }
      catch{
        res.status(500).json({ error: err.message });
      }
     }


     // to fetch the employement status data :-
     static async employementController(req, res){
      try{
        const result= await data.employementStatus();
        if(result && result.length>0){
         return res.status(200).json({message : "Employement status data is fetched successfully", 
          question_id:2 , result});
        }
        return res.status(404).json({message:"No data found", result });
      }
      catch{
        res.status(500).json({ error: err.message });
      }
     }









     static async getquesAns(req, res){
     try{
      const result= await data.getQuestionAnswers();
      console.log("questionAnswers :",result);
      return res.status(200).json(result);
     }
     catch(err){
      return res.status(500).json({message:"internal server error"});
     }
     }



      static async getSectorIndustries(req, res) {
        try {
          const [result] = await data.getSectorIndustryHierarchy();
    
          if (result && result.length > 0) {
            return res.status(200).json({
              message: "sector_industry and subIndustry data fetched successfully.",
              result
            });
          }
    
          return res.status(204).json({
            message: "No data found",
            result: []
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      }
  }



  
  module.exports = DataController 