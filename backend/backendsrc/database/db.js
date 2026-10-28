const mongoose = require("mongoose");
require("dotenv").config();


async function connectDB(){
  

    try{
        await mongoose.connect(process.env.MONGO_URI)
        console.log("connect db success")
    }

    catch (error){
        console.error('database connection error:',error);
         
    }
}

module.exports = connectDB;
