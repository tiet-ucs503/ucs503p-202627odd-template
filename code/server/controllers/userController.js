import User from "../models/User.js";
import { updateUser } from "../services/userService.js";
export async function getUser(req,res){
  const user=await User.findById(req.params.id).select("-password");
  if(!user) return res.status(404).json({message:"User not found"});
  res.json({user});
}
export async function updateProfile(req,res){ res.json({user:await updateUser(req.user._id,req.body)}); }
