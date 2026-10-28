require('dotenv').config()

const app = require("./backendsrc/app");
const connectDB = require("./backendsrc/database/db")
connectDB();

app.listen(3000,()=>{
    console.log("server is connected successfully")
})