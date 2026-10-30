import { Request, Response } from "express";
import { Order, Offering, Vendor, Review } from "../models";

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { offeringId, quantity = 1, scheduledAt, customerNote, address } = req.body;
    const customerId = (req.user as any)?.id || (req.user as any)?.userId;

    const offering = await Offering.findByPk(offeringId);
    if (!offering) return res.status(404).json({ error: "Offering not found" });
    if (!offering.isAvailable) return res.status(400).json({ error: "Offering is currently unavailable" });

    let finalQuantity = quantity;
    if (offering.type === "PRODUCT") {
      if (offering.stock < finalQuantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }
    } else {
      finalQuantity = 1; // Services usually don't have quantities, just 1 scheduled appointment
    }

    const price = offering.price || 0;
    const totalAmount = price * finalQuantity;

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const order = await Order.create({
      orderNumber,
      customerId,
      vendorId: offering.vendorId,
      offeringId: offering.id,
      quantity: finalQuantity,
      type: offering.type,
      price,
      totalAmount,
      address,
      scheduledAt: scheduledAt || null,
      status: "PENDING",
      paymentStatus: "PENDING",
      customerNote
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const customerId = (req.user as any)?.id || (req.user as any)?.userId;
    const orders = await Order.findAll({
      where: { customerId },
      include: [
        { model: Vendor, as: "vendor", attributes: ["businessName", "imageUrl"] },
        { model: Offering, as: "Offering", attributes: ["name", "imageUrl", "type", "price", "unit"] }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const customerId = (req.user as any)?.id || (req.user as any)?.userId;
    const order = await Order.findOne({
      where: { id: req.params.id, customerId },
      include: [
        { model: Vendor, as: "vendor", attributes: ["businessName", "imageUrl", "phone"] },
        { model: Offering, as: "Offering", attributes: ["name", "imageUrl", "type", "price", "unit", "durationMinutes"] },
        { model: Review, as: "review" }
      ]
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};
