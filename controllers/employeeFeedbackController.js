const employeeFeedbackData= require('../models/employeeFeedbackModel');



class employeeFeedbackController{
    static async saveFeedback(req, res) {
        try {
            const data = req.body; // extract data from the request body
            const result = await employeeFeedbackData.saveEmployeeFeedback(data); // call model function
            res.status(201).json({ message: "Feedback saved successfully" });
        } catch (err) {
            console.error("Error saving feedback:", err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }


    static async fetchFeedbackData(req,res){
        try{
            const {company_id}=req.body;
            if (!company_id) {
                return res.status(400).json({ message: "company_id is required" });
            }
            const result=  await employeeFeedbackData.fetchEmployeeFeedback(company_id);
           
            return res.status(200).json({message: "data fetched successfully!", result});
        }
        catch(err){
            return res.status(500).json({message:"internal server error"});
        }
    }

    static async fetchEmployees(req,res){
        try{
            const {company_id}=req.body;
            if (!company_id) {
                return res.status(400).json({ message: "company_id is required" });
            }
            const result=  await employeeFeedbackData.fetchEmployees(company_id);

            return res.status(200).json({message: "data fetched successfully!", result});
        }
        catch(err){
            return res.status(500).json({message:"internal server error"});
        }
    }

}
    



module.exports=employeeFeedbackController;