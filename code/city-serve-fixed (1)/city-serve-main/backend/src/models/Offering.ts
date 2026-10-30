import { DataTypes, Model, Optional } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/database";

export type OfferingType = "PRODUCT" | "SERVICE";

export interface OfferingAttributes {
  id: string;
  vendorId: string;
  categoryId: string;
  type: OfferingType;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  unit: string | null;
  stock: number;
  durationMinutes: number;
  isAvailable: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type OfferingCreationAttributes = Optional<
  OfferingAttributes,
  "id" | "description" | "imageUrl" | "price" | "unit" | "stock" | "durationMinutes" | "isAvailable"
>;

export class Offering
  extends Model<OfferingAttributes, OfferingCreationAttributes>
  implements OfferingAttributes {
  declare id: string;
  declare vendorId: string;
  declare categoryId: string;
  declare type: OfferingType;
  declare name: string;
  declare description: string | null;
  declare imageUrl: string | null;
  declare price: number | null;
  declare unit: string | null;
  declare stock: number;
  declare durationMinutes: number;
  declare isAvailable: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Offering.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM("PRODUCT", "SERVICE"), allowNull: false, defaultValue: "PRODUCT" },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    unit: { type: DataTypes.STRING(30), allowNull: true },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "Offering",
    tableName: "offerings",
    indexes: [
      { fields: ["vendorId"] },
      { fields: ["categoryId"] },
      { fields: ["type"] },
      { fields: ["isAvailable"] },
    ],
  }
);
