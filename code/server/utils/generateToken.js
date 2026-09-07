import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
export default function generateToken(userId) {
  return jwt.sign({id:userId}, config.jwtSecret, {expiresIn:"7d"});
}
