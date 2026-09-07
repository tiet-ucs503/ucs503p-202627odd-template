import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  title: { type:String, required:true, trim:true },
  description: { type:String, required:true },
  category: { type:String, default:"Other" },
  requiredSkills: [String],
  creator: { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  teamSize: { type:Number, default:4, min:1 },
  members: [{ type:mongoose.Schema.Types.ObjectId, ref:"User" }],
  deadline: Date,
  status: { type:String, enum:["open","closed","completed"], default:"open" }
}, { timestamps:true });

export default mongoose.model("Project", projectSchema);
