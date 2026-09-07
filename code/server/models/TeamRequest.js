import mongoose from "mongoose";

const teamRequestSchema = new mongoose.Schema({
  team: { type:mongoose.Schema.Types.ObjectId, ref:"Team", required:true },
  user: { type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  status: { type:String, enum:["pending","accepted","rejected"], default:"pending" }
}, { timestamps:true });

teamRequestSchema.index({ team:1, user:1 }, { unique:true });

export default mongoose.model("TeamRequest", teamRequestSchema);
