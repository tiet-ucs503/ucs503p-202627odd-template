import { DataTypes, Model, Optional } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/database";

export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  address: string | null;
  city: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreationAttributes = Optional<UserAttributes, "id" | "role" | "address" | "city">;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare name: string;
  declare email: string;
  declare phone: string;
  declare passwordHash: string;
  declare role: Role;
  declare address: string | null;
  declare city: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM("CUSTOMER", "VENDOR", "ADMIN"), allowNull: false, defaultValue: "CUSTOMER" },
    address: { type: DataTypes.STRING(300), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
  },
  { sequelize, modelName: "User", tableName: "users", indexes: [{ fields: ["role"] }] }
);
