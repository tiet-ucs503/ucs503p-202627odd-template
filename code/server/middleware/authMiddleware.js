import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/config.js";

export async function protect(req,res,next) {
  try {
    const header=req.headers.authorization;
    if(!header?.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required"});
    const token=header.split(" ")[1];
    const decoded=jwt.verify(token,config.jwtSecret);
    req.user=await User.findById(decoded.id).select("-password");
    if(!req.user) return res.status(401).json({message:"User not found"});
    next();
  } catch { res.status(401).json({message:"Invalid or expired token"}); }
}
