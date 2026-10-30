import { DataTypes, Model, Optional } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/database";

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export interface OrderAttributes {
  id: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  offeringId: string;
  quantity: number;
  type: "PRODUCT" | "SERVICE";
  price: number;
  totalAmount: number;
  address: string | null;
  scheduledAt: Date | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerNote: string | null;
  vendorNote: string | null;
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type OrderCreationAttributes = Optional<
  OrderAttributes,
  | "id"
  | "quantity"
  | "address"
  | "scheduledAt"
  | "status"
  | "paymentStatus"
  | "customerNote"
  | "vendorNote"
  | "completedAt"
  | "createdAt"
>;

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare orderNumber: string;
  declare customerId: string;
  declare vendorId: string;
  declare offeringId: string;
  declare quantity: number;
  declare type: "PRODUCT" | "SERVICE";
  declare price: number;
  declare totalAmount: number;
  declare address: string | null;
  declare scheduledAt: Date | null;
  declare status: OrderStatus;
  declare paymentStatus: PaymentStatus;
  declare customerNote: string | null;
  declare vendorNote: string | null;
  declare completedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Order.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    orderNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    customerId: { type: DataTypes.UUID, allowNull: false },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    offeringId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    type: { type: DataTypes.ENUM("PRODUCT", "SERVICE"), allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    address: { type: DataTypes.STRING(300), allowNull: true },
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    paymentStatus: {
      type: DataTypes.ENUM("PENDING", "PAID", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    customerNote: { type: DataTypes.TEXT, allowNull: true },
    vendorNote: { type: DataTypes.TEXT, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
    indexes: [
      { fields: ["customerId"] },
      { fields: ["vendorId"] },
      { fields: ["status"] },
      { fields: ["paymentStatus"] },
    ],
  }
);
