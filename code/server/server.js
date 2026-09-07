import app from "./app.js";
import connectDB from "./config/db.js";
import { config } from "./config/config.js";

await connectDB();
app.listen(config.port,()=>console.log(`TeamUp server running on http://localhost:${config.port}`));
