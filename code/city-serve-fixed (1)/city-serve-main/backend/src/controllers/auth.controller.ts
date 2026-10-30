import { Request, Response } from "express";
import { User, Vendor, Category } from "../models";
import { sequelize } from "../config/database";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { Op } from "sequelize";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

import { Role } from "../models/User";

// ...

function issueTokens(res: Response, userId: string, role: Role) {
  const accessToken = signAccessToken({ userId, role });
  const refreshToken = signRefreshToken({ userId, role });
  res.cookie("accessToken", accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  return { accessToken, refreshToken };
}

export const registerCustomer = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, address, city } = req.body;
    if (!name || !email || !password || !phone) return res.status(400).json({ error: "Missing required fields" });

    const existing = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
    if (existing) return res.status(409).json({ error: "An account with this email/phone already exists." });

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, phone, passwordHash, role: "CUSTOMER", address: address || null, city: city || null });

    const tokens = issueTokens(res, user.id, user.role);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, address: user.address, city: user.city }, ...tokens });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const registerVendor = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, businessName, categoryId, type, description, address, city, latitude, longitude } = req.body;
    if (!name || !email || !password || !businessName || !categoryId) return res.status(400).json({ error: "Missing required fields" });

    const existing = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
    if (existing) return res.status(409).json({ error: "An account with this email/phone already exists." });

    const passwordHash = await hashPassword(password);

    const { user, vendor } = await sequelize.transaction(async (t) => {
      const createdUser = await User.create({ name, email, phone, passwordHash, role: "VENDOR", address, city }, { transaction: t });
      const createdVendor = await Vendor.create(
        { userId: createdUser.id, businessName, categoryId, type: type || "BOTH", description, address, city, phone, latitude, longitude, isVerified: false, isActive: true },
        { transaction: t }
      );
      return { user: createdUser, vendor: createdVendor };
    });

    const tokens = issueTokens(res, user.id, user.role);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, vendor, ...tokens });
  } catch (error) {
    res.status(500).json({ error: "Vendor registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const vendor = user.role === "VENDOR" ? await Vendor.findOne({ where: { userId: user.id } }) : null;
    const tokens = issueTokens(res, user.id, user.role);

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, address: user.address, city: user.city }, vendor: vendor ?? undefined, ...tokens });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully." });
};

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token provided." });

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findByPk((payload as any).userId);
    if (!user) return res.status(401).json({ error: "Account no longer exists." });

    const tokens = issueTokens(res, user.id, user.role);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Refresh token invalid." });
  }
};

export const updateMe = async (req: any, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    const user = await User.findByPk(req.user.userId || req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const { name, phone, address, city } = req.body;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    await user.save();

    const safeUser: any = user.toJSON();
    delete safeUser.passwordHash;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: "Could not update profile." });
  }
};

export const me = async (req: any, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    const user = await User.findByPk(req.user.userId || req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const vendor = await Vendor.findOne({ where: { userId: user.id } });

    const safeUser: any = user.toJSON();
    delete safeUser.passwordHash;
    if (vendor) safeUser.vendor = vendor;

    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: "Session check failed." });
  }
};
