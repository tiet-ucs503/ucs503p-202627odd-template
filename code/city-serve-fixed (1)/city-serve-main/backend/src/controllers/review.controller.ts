import { Request, Response } from "express";
import { Review, Vendor, Offering, Order, User } from "../models";

export const createReview = async (req: any, res: Response) => {
  try {
    const { orderId, rating, comment } = req.body;
    const customerId = req.user!.id;

    if (!orderId) return res.status(400).json({ error: "orderId is required" });

    const order = await Order.findOne({ where: { id: orderId, customerId, status: "COMPLETED" } });
    if (!order) return res.status(400).json({ error: "Only completed orders can be reviewed." });

    const existing = await Review.findOne({ where: { orderId: order.id } });
    if (existing) return res.status(409).json({ error: "You have already reviewed this order." });

    const review = await Review.create({
      customerId,
      vendorId: order.vendorId,
      offeringId: order.offeringId,
      orderId: order.id,
      rating,
      comment: comment ?? null
    });

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create review." });
  }
};

export const listMyReviews = async (req: any, res: Response) => {
  try {
    const customerId = req.user!.id || req.user!.userId;
    const reviews = await Review.findAll({
      where: { customerId },
      include: [
        { model: Vendor, as: "vendor", attributes: ["businessName", "imageUrl"] },
        { model: Offering, as: "offering", attributes: ["name", "imageUrl"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to list your reviews." });
  }
};

export const listVendorReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.findAll({
      where: { vendorId: req.params.vendorId },
      include: [{ model: User, as: "customer", attributes: ["name"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to list reviews." });
  }
};
