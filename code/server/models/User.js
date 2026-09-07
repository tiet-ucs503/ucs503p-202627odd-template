import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type:String, required:true, trim:true },
  email: { type:String, required:true, unique:true, lowercase:true, trim:true },
  password: { type:String, required:true },
  college: String,
  course: String,
  year: String,
  bio: String,
  profileImage: String,
  skills: [String],
  interests: [String]
}, { timestamps:true });

export default mongoose.model("User", userSchema);
