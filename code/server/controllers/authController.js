import { registerUser, loginUser } from "../services/authService.js";
import User from "../models/User.js";

export async function register(req,res) {
  try { res.status(201).json(await registerUser(req.body)); }
  catch(e){ res.status(400).json({message:e.message}); }
}
export async function login(req,res) {
  try { res.json(await loginUser(req.body.email,req.body.password)); }
  catch(e){ res.status(401).json({message:e.message}); }
}
export async function me(req,res){ res.json({user:req.user}); }
