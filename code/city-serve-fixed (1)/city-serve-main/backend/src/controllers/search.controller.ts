import { Op } from "sequelize";
import { Offering, Vendor, Category } from "../models";
import { Request, Response } from "express";
import { getDatasetVendors } from "../services/dataset.service";

export const search = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ offerings: [], vendors: [], categories: [] });

    let offerings: any[] = [];
    let vendors: any[] = [];
    let categories: any[] = [];

    try {
      [offerings, vendors, categories] = await Promise.all([
        Offering.findAll({
          where: { isAvailable: true, name: { [Op.like]: `%${q}%` } },
          include: [{ model: Vendor, as: "vendor", attributes: ["businessName", "isVerified"] }],
          limit: 10,
        }).catch(() => []),
        Vendor.findAll({
          where: {
            isActive: true,
            [Op.or]: [
              { businessName: { [Op.like]: `%${q}%` } },
              { description: { [Op.like]: `%${q}%` } }
            ],
          },
          include: [{ model: Category, as: "category", attributes: ["name"] }],
          limit: 10,
        }).catch(() => []),
        Category.findAll({ where: { name: { [Op.like]: `%${q}%` } } }).catch(() => []),
      ]);
    } catch {
      // ignore db errors
    }

    const datasetMatches = getDatasetVendors({ q }).slice(0, 15);
    const combinedVendors = [...vendors, ...datasetMatches];

    res.json({ offerings, vendors: combinedVendors, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Search failed." });
  }
};
