import { DataTypes, Model, Optional } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { sequelize } from "../config/database";

export type VendorType = "PRODUCT" | "SERVICE" | "BOTH";

export interface VendorAttributes {
    id: string;
    userId: string;
    businessName: string;
    description: string | null;
    categoryId: string;
    type: VendorType;
    phone: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    imageUrl: string | null;
    isVerified: boolean;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

type VendorCreationAttributes = Optional<
    VendorAttributes,
    "id" | "description" | "phone" | "address" | "city" | "latitude" | "longitude" | "imageUrl" | "isVerified" | "isActive"
>;

export class Vendor extends Model<VendorAttributes, VendorCreationAttributes> implements VendorAttributes {
    declare id: string;
    declare userId: string;
    declare businessName: string;
    declare description: string | null;
    declare categoryId: string;
    declare type: VendorType;
    declare phone: string | null;
    declare address: string | null;
    declare city: string | null;
    declare latitude: number | null;
    declare longitude: number | null;
    declare imageUrl: string | null;
    declare isVerified: boolean;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Vendor.init(
    {
        id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false, unique: true },
        businessName: { type: DataTypes.STRING(150), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        categoryId: { type: DataTypes.UUID, allowNull: false },
        type: { type: DataTypes.ENUM("PRODUCT", "SERVICE", "BOTH"), allowNull: false },
        phone: { type: DataTypes.STRING(30), allowNull: true },
        address: { type: DataTypes.STRING(300), allowNull: true },
        city: { type: DataTypes.STRING(100), allowNull: true },
        latitude: { type: DataTypes.FLOAT, allowNull: true },
        longitude: { type: DataTypes.FLOAT, allowNull: true },
        imageUrl: { type: DataTypes.STRING(500), allowNull: true },
        isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
        sequelize,
        modelName: "Vendor",
        tableName: "vendors",
        indexes: [{ fields: ["categoryId"] }, { fields: ["city"] }, { fields: ["isVerified"] }],
    }
);
