import { Request, Response } from "express";
import { Op } from "sequelize";
import { Offering, Vendor, Category } from "../models";

export const listOfferings = async (req: Request, res: Response) => {
  try {
    const { type, categorySlug, q, vendorId } = req.query as Record<string, string>;
    const where: any = { isAvailable: true };
    if (type) where.type = type;
    if (vendorId) where.vendorId = vendorId;
    if (q) where.name = { [Op.like]: `%${q}%` };

    const categoryWhere = categorySlug ? { slug: categorySlug } : undefined;

    const offerings = await Offering.findAll({
      where,
      include: [
        { model: Vendor, as: "vendor", attributes: ["businessName", "city", "isVerified"] },
        { model: Category, as: "category", where: categoryWhere, required: !!categoryWhere },
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(offerings);
  } catch (error) {
    res.status(500).json({ error: "Failed to list offerings." });
  }
};

export const getOffering = async (req: Request, res: Response) => {
  try {
    const offering = await Offering.findByPk(req.params.id, {
      include: [{ model: Vendor, as: "vendor" }, { model: Category, as: "category" }]
    });
    if (!offering) return res.status(404).json({ error: "Offering not found." });
    res.json(offering);
  } catch (error) {
    res.status(500).json({ error: "Failed to get offering." });
  }
};

export const createOffering = async (req: any, res: Response) => {
  try {
    const vendor = await Vendor.findOne({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(403).json({ error: "Only vendors can create offerings." });

    const offering = await Offering.create({ ...req.body, vendorId: vendor.id });
    res.status(201).json(offering);
  } catch (error) {
    res.status(500).json({ error: "Failed to create offering." });
  }
};

export const updateOffering = async (req: any, res: Response) => {
  try {
    const vendor = await Vendor.findOne({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(403).json({ error: "Only vendors can upate offerings." });

    const offering = await Offering.findOne({ where: { id: req.params.id, vendorId: vendor.id } });
    if (!offering) return res.status(404).json({ error: "Offering not found." });

    await offering.update(req.body);
    res.json(offering);
  } catch (error) {
    res.status(500).json({ error: "Failed to update offering." });
  }
};

// Aliased helpers for frontend backward compatibility
export const listProducts = (req: Request, res: Response) => {
  req.query.type = "PRODUCT";
  return listOfferings(req, res);
};

export const getProduct = getOffering;

export const listServices = (req: Request, res: Response) => {
  req.query.type = "SERVICE";
  return listOfferings(req, res);
};

export const getService = getOffering;
