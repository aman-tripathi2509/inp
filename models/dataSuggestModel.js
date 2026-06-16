const db = require("../config/db");// getting the database connection

class data{
    static async CompanydataSuggest() {
        try {
            
            const sql = `select company_id, company_name from trx_company_registration`;
           // const values = [name, email, phone_no, contact_method, message];
            const [result] = await db.execute(sql); // Execute SQL query
            //console.log(result);
            return result;
        }
        catch (error) {
            console.error("Error while fetching the company_name data", error);
            throw error; // ✅ better to throw error, controller will handle it
        } 
    } 






    static async EmployeedataSuggest() {
        try {
            
            const sql = `select answer from lu_question_answer where question_id=11`;
           // const values = [name, email, phone_no, contact_method, message];
            const [result] = await db.execute(sql); // Execute SQL query
            //console.log(result);
            return result;
        }
        catch (error) {
            console.error("Error while fetching the Employees data", error);
            throw error; // ✅ better to throw error, controller will handle it
        } 
    } 

    
    static async RevenuedataSuggest() {
        try {
            
            const sql = `select answer from lu_question_answer where question_id=12`;
           // const values = [name, email, phone_no, contact_method, message];
            const [result] = await db.execute(sql); // Execute SQL query
            console.log(result);
            return result;
        }
        catch (error) {
            console.error("Error while fetching the Revenue data", error);
            throw error; 
        } 
    } 


    static async getSectorIndustryHierarchy() {
        try {
          const [rows] = await db.execute(
            `SELECT question_id, question_answer_id, parent_answer_id, answer
             FROM lu_question_answer
             WHERE question_id IN (68, 69, 70)`
          );
     
          const sectors = rows.filter(row => row.question_id === 68);
          const industries = rows.filter(row => row.question_id === 69);
          const subIndustries = rows.filter(row => row.question_id === 70);
     
          const response = sectors.map(sector => {
            const sectorIndustries = industries
              .filter(ind => ind.parent_answer_id === sector.question_answer_id)
              .map(ind => {
                const relatedSubIndustries = subIndustries
                  .filter(sub => sub.parent_answer_id === ind.question_answer_id)
                  .map(sub => sub.answer.trim());
      
                return {
                  industry: ind.answer.trim(),
                  sub_industries: relatedSubIndustries
                };
              });
     
            return {
              sector: sector.answer,
              industries: sectorIndustries
            };
          });
      
          return [response];
        } catch (err) {
          console.error("Error in getSectorIndustryHierarchy:", err);
          throw err;
        }
      }


      static async workStatus(req,res){
        try{
          const query=`select answer from lu_question_answer where question_id=1`;
          const [result]= await db.execute(query);
          console.log(result);
          return result;
        }
        catch(err){
          console.error("err.message :-" ,err.message);
          throw err;
        }
      }



      static async employementStatus(){
        try{
          const query=`select answer from lu_question_answer where question_id=2`;
          const [result]= await db.execute(query);
          return result;
        }
        catch(err){
          console.log("error while fetching the data for employement Status : ", err.message);
          throw err;
        }
      }

      // to fetch the question and answers from lu_question and lu_question_answer table:-
      static async getQuestionAnswers(){
        try{
          const param = [1, 2, 3, 5,8,9,11,12,17];
          const placeholders = param.map(() => '?').join(','); // "?,?,?,?"
          const query1 = `select question_id, question_type_header, question, question_type FROM lu_question WHERE question_id IN (${placeholders})`;
          const [result1] = await db.execute(query1, param);

           
           //const placeholders = param.map(() => '?').join(',');
           const query2=`select question_id, answer from lu_question_answer where question_id in (${placeholders})`;
           
          const [result2]=await db.execute(query2,param);
          //const questionIds = result1.map(q => q.question_id);


          // Group answers by question_id
            const answersMap = {};
            result2.forEach(row => {
              if (!answersMap[row.question_id]) {
                answersMap[row.question_id] = [];
              }
              answersMap[row.question_id].push(row.answer);
            });

            // Merge answers into question result
            const combinedResult = result1.map(q => ({
              ...q,
              answers: answersMap[q.question_id] || []
            }));
           return combinedResult;
          //return result1;
          
        }
          
        catch(err){
          console.log("error while fetching the questionAnswers data :", err.message);
          throw err;
        }
      }
}


module.exports=data;
