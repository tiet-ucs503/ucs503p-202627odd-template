import mongoose from "mongoose";

const teamSchema = new mongoose.Schema({
  name: { type:String, required:true, trim:true },
  project: { type:mongoose.Schema.Types.ObjectId, ref:"Project", required:true },
  owner: { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  members: [{ type:mongoose.Schema.Types.ObjectId, ref:"User" }]
}, { timestamps:true });

export default mongoose.model("Team", teamSchema);
