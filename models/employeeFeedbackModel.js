const db = require("../config/db");// getting the database connection


class employeeFeedback{

    static async saveEmployeeFeedback(data) {
        try{
        const {member_id,company_id,employee_satisfaction_rating,company_culture_rating,easy_of_working_rating,work_life_balance_rating,
            top_management_rating,hr_attitute_rating,ceo_rating}=data;
        const query=`INSERT INTO inp_employee_feedback(member_id,company_id,employee_satisfaction_rating,company_culture_rating,easy_of_working_rating,work_life_balance_rating,
            top_management_rating,hr_attitute_rating,ceo_rating) VALUES (?, ?, ?, ?, ?,?, ?, ?, ?)`;
        const params=[member_id,company_id,employee_satisfaction_rating,company_culture_rating,easy_of_working_rating,work_life_balance_rating,
            top_management_rating,hr_attitute_rating,ceo_rating];
        const result=  await db.execute(query,params);
            return result;
        } 
        catch(err){
            console.log("error occur while storing the data: ",err);
            throw err;
        }
    }


    static async fetchEmployeeFeedback(companyID){
        try{
            console.log("comapny_id:- ", companyID);
            const query= `select company_id,AVG(employee_satisfaction_rating) AS avg_satisfaction,
            AVG(company_culture_rating) AS avg_culture,
            AVG(easy_of_working_rating) AS avg_easy_working,
            AVG(work_life_balance_rating) AS avg_work_life,
            AVG(top_management_rating) AS avg_management,
            AVG(hr_attitute_rating) AS avg_hr,
            AVG(ceo_rating) AS avg_ceo from inp_employee_feedback where company_id=? AND status=1 group by company_id`;
            const params=[companyID];
            const [result]= await db.execute(query,params);
            console.log("result: ", result);
            console.log("result: ",result);
            return result;
        }
        catch(err){
            console.log("error while fetching the data from the table ", err.message);
            throw err;
        }
    }

    static async fetchEmployees(companyID){
        try{
            console.log("comapny_id:- ", companyID);
            const query= `select first_name,middle_name,last_name,profile_photo,job_title,facebook,instagram,linkedin from user_demographic_details where current_company=?`;
            const params=[companyID];
            const [result]= await db.execute(query,params);
            console.log("result: ", result);
            return result;
        }
        catch(err){
            console.log("error while fetching the data from the table ", err.message);
            throw err;
        }
    }
}

module.exports=employeeFeedback;