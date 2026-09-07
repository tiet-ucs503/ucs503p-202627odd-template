import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

export async function registerUser(payload) {
  const existing=await User.findOne({email:payload.email.toLowerCase()});
  if(existing) throw new Error("Email already registered");
  const password=await bcrypt.hash(payload.password,12);
  const user=await User.create({...payload,email:payload.email.toLowerCase(),password});
  return {token:generateToken(user._id),user:await User.findById(user._id).select("-password")};
}
export async function loginUser(email,password) {
  const user=await User.findOne({email:email.toLowerCase()});
  if(!user || !(await bcrypt.compare(password,user.password))) throw new Error("Invalid email or password");
  return {token:generateToken(user._id),user:await User.findById(user._id).select("-password")};
}
