
//const companyModel = require("../models/companyModel");
// const userModel=require("../models/userModel")
const autoSuggestModel=require("../models/autoSuggestModel") //here userModel is a varible using which we are calling UserSuggest:-
//dotenv.config();


//arrow function to register a new user
    const autoSuggest = async (req, res) => {
        const search= req.body.search;
        console.log(" controller search:-", search);
       
    try{
        if (!search || search.trim() === "") {
            return res.status(400).json({
              message: "Search field is required"
            });
        }
        const companyDetails = await autoSuggestModel.CompanyDataSuggest(search);
       const userDetails=await autoSuggestModel.UserSuggest(search);
        // res.status(200).json({ message: "AutoSuggest details fetched succesfully",
        //     companyDetails });
        res.status(200).json({ message: "AutoSuggest details fetched succesfully",
            companyDetails , userDetails });

    }catch(err){
        console.log(err)
        res.status(500).json({ message:  err.message});
    }
};






// Export the function separately
module.exports =  autoSuggest ;
