import { DataTypes, Model, Optional } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/database";

export interface ReviewAttributes {
  id: string;
  customerId: string;
  vendorId: string;
  offeringId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ReviewCreationAttributes = Optional<ReviewAttributes, "id" | "comment">;

export class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  declare id: string;
  declare customerId: string;
  declare vendorId: string;
  declare offeringId: string;
  declare orderId: string;
  declare rating: number;
  declare comment: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Review.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    customerId: { type: DataTypes.UUID, allowNull: false },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    offeringId: { type: DataTypes.UUID, allowNull: false },
    orderId: { type: DataTypes.UUID, allowNull: false, unique: true },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "Review",
    tableName: "reviews",
    indexes: [{ fields: ["vendorId"] }, { fields: ["offeringId"] }, { fields: ["customerId"] }],
  }
);
