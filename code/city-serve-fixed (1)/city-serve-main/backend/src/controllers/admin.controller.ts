import { Op, fn, col } from "sequelize";
import { User, Vendor, Category, Order, Offering } from "../models";
import { Request, Response } from "express";

export const listUsers = async (req: Request, res: Response) => {
  try {
    const { role, q, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const where: any = {};
    if (role) where.role = role;
    if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];

    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      attributes: ["id", "name", "email", "phone", "role", "address", "city", "createdAt"],
      limit: take,
      offset: skip,
      order: [["createdAt", "DESC"]],
    });
    res.json({ users, total, page: Number(page), pageSize: take });
  } catch (error) {
    res.status(500).json({ error: "Failed to list users" });
  }
};

export const listAllVendors = async (req: Request, res: Response) => {
  try {
    const { isVerified, q, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const where: any = {};
    if (isVerified !== undefined) where.isVerified = isVerified === "true";
    if (q) where.businessName = { [Op.like]: `%${q}%` };

    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const { rows: vendors, count: total } = await Vendor.findAndCountAll({
      where,
      include: [{ model: Category, as: "category", attributes: ["name"] }, { model: User, attributes: ["email", "phone"] }],
      limit: take,
      offset: skip,
      order: [["createdAt", "DESC"]],
    });
    res.json({ vendors, total, page: Number(page), pageSize: take });
  } catch (error) {
    res.status(500).json({ error: "Failed to list vendors" });
  }
};

export const toggleVendorVerify = async (req: Request, res: Response) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Vendor not found." });
    vendor.isVerified = !vendor.isVerified;
    await vendor.save();
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle vendor verification" });
  }
};

export const analytics = async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalVendors,
      totalOrders,
      completedOrders,
      cancelledOrders,
      revenueOrdersAgg,
      categories,
    ] = await Promise.all([
      User.count({ where: { role: "CUSTOMER" } }),
      Vendor.count(),
      Order.count(),
      Order.count({ where: { status: "COMPLETED" } }),
      Order.count({ where: { status: "CANCELLED" } }),
      Order.findOne({ where: { status: "COMPLETED" }, attributes: [[fn("SUM", col("totalAmount")), "sum"]], raw: true }) as any,
      Category.findAll({ order: [["name", "ASC"]] })
    ]);

    const popularCategories = await Promise.all(categories.map(async (c) => {
      const vendorCount = await Vendor.count({ where: { categoryId: c.id } });
      const offeringCount = await Offering.count({ where: { categoryId: c.id } });
      return { name: c.name, vendorCount, offeringCount };
    }));

    res.json({
      totalUsers,
      totalVendors,
      totalOrders,
      completedOrders,
      revenue: Number(revenueOrdersAgg?.sum ?? 0),
      cancellationRate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 1000) / 10 : 0,
      popularCategories,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get analytics" });
  }
};
