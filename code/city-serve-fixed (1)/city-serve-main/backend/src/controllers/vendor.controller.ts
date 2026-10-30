import { Request, Response } from "express";
import { Vendor, Offering, Category, Order, User } from "../models";
import { env } from "../config/env";
import { getDatasetVendors, getDatasetBusinesses, datasetToVendor } from "../services/dataset.service";

export const listVendors = async (req: Request, res: Response) => {
    try {
        const queryFilter = {
            q: req.query.q as string | undefined,
            category: req.query.category as string | undefined,
            locality: req.query.locality as string | undefined,
        };

        const datasetVendors = getDatasetVendors(queryFilter);

        let dbVendors: any[] = [];
        try {
            dbVendors = await Vendor.findAll({
                where: { isActive: true },
                include: [{ model: Category, as: "category", attributes: ["name", "icon"] }],
                order: [["isVerified", "DESC"], ["createdAt", "DESC"]],
                limit: 500
            });
        } catch (dbErr) {
            // DB table may not be migrated; CSV dataset provides robust fallback
        }

        // Return combined listings (database partners + CSV dataset listings)
        const combined = [...dbVendors, ...datasetVendors];
        res.json(combined);
    } catch (error) {
        console.error("Error in listVendors:", error);
        res.status(500).json({ error: "Failed to list vendors" });
    }
};

export const getVendorById = async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
        let vendor: any = null;
        try {
            vendor = await Vendor.findByPk(id, {
                include: [
                    { model: Category, as: "category", attributes: ["id", "name", "slug"] },
                    { model: Offering, attributes: ["id", "name", "type", "price", "unit", "durationMinutes", "isAvailable", "imageUrl"] }
                ]
            });
        } catch {
            // fallback to dataset
        }

        if (vendor) {
            return res.json(vendor);
        }

        // Search dataset
        const businesses = getDatasetBusinesses();
        const found = businesses.find((b) => b.place_id === id || encodeURIComponent(b.business_name.toLowerCase().replace(/\s+/g, "-")) === id || b.business_name.toLowerCase() === id.toLowerCase());

        if (found) {
            return res.json(datasetToVendor(found));
        }

        return res.status(404).json({ error: "Vendor not found" });
    } catch (error) {
        console.error("Error in getVendorById:", error);
        res.status(500).json({ error: "Failed to fetch vendor" });
    }
};

export const getVendorOrders = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?.id || (req.user as any)?.userId;
        const vendor = await Vendor.findOne({ where: { userId } });
        if (!vendor) return res.status(404).json({ error: "Vendor profile not found" });

        const orders = await Order.findAll({
            where: { vendorId: vendor.id },
            include: [
                { model: Offering, as: "Offering", attributes: ["name", "imageUrl", "type", "price", "unit", "durationMinutes"] },
                { model: User, as: "customer", attributes: ["name", "phone"] }
            ],
            order: [["createdAt", "DESC"]]
        });
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch vendor orders" });
    }
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["COMPLETED"],
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const userId = (req.user as any)?.id || (req.user as any)?.userId;
        const vendor = await Vendor.findOne({ where: { userId } });
        if (!vendor) return res.status(404).json({ error: "Vendor profile not found" });

        const order = await Order.findOne({ where: { id: req.params.id, vendorId: vendor.id } });
        if (!order) return res.status(404).json({ error: "Order not found" });

        const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Cannot move an order from ${order.status} to ${status}.` });
        }

        order.status = status;
        if (status === "COMPLETED") {
            order.completedAt = new Date();
        }
        await order.save();

        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update order status" });
    }
};
