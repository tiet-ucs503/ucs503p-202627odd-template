import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { Role } from "../models/User";

export interface AuthedRequest extends Request { }

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId, userId: payload.userId, role: payload.role as Role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

// Attaches req.user if a valid token is present, but does not block the request otherwise.
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.userId, userId: payload.userId, role: payload.role as Role };
    } catch {
      // ignore invalid token in optional mode
    }
  }
  next();
}
