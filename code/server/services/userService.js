import User from "../models/User.js";
export async function updateUser(id,payload){ return User.findByIdAndUpdate(id,payload,{new:true,runValidators:true}).select("-password"); }
