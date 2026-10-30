import { User } from "./User";
import { Vendor } from "./Vendor";
import { Category } from "./Category";
import { Offering } from "./Offering";
import { Order } from "./Order";
import { Review } from "./Review";

// -------------------------------------------------------------
// USER -> VENDOR
// 1 User can have 1 Vendor profile
// -------------------------------------------------------------
User.hasOne(Vendor, { foreignKey: "userId", onDelete: "CASCADE" });
Vendor.belongsTo(User, { foreignKey: "userId" });

// -------------------------------------------------------------
// CATEGORY -> VENDOR
// 1 Category can have many Vendors
// -------------------------------------------------------------
Category.hasMany(Vendor, { foreignKey: "categoryId" });
Vendor.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// -------------------------------------------------------------
// VENDOR -> OFFERING
// 1 Vendor has many Offerings
// -------------------------------------------------------------
Vendor.hasMany(Offering, { foreignKey: "vendorId", onDelete: "CASCADE" });
Offering.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

// -------------------------------------------------------------
// CATEGORY -> OFFERING
// 1 Category has many Offerings
// -------------------------------------------------------------
Category.hasMany(Offering, { foreignKey: "categoryId" });
Offering.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// -------------------------------------------------------------
// USER -> ORDER
// 1 User (Customer) has many Orders
// -------------------------------------------------------------
User.hasMany(Order, { foreignKey: "customerId", as: "customerOrders" });
Order.belongsTo(User, { foreignKey: "customerId", as: "customer" });

// -------------------------------------------------------------
// VENDOR -> ORDER
// 1 Vendor receives many Orders
// -------------------------------------------------------------
Vendor.hasMany(Order, { foreignKey: "vendorId", as: "vendorOrders" });
Order.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

// -------------------------------------------------------------
// OFFERING -> ORDER
// 1 Offering can have many Orders
// -------------------------------------------------------------
Offering.hasMany(Order, { foreignKey: "offeringId" });
Order.belongsTo(Offering, { foreignKey: "offeringId", as: "Offering" });

// -------------------------------------------------------------
// USER -> REVIEW
// 1 User (Customer) writes many Reviews
// -------------------------------------------------------------
User.hasMany(Review, { foreignKey: "customerId", as: "customerReviews" });
Review.belongsTo(User, { foreignKey: "customerId", as: "customer" });

// -------------------------------------------------------------
// VENDOR -> REVIEW
// 1 Vendor receives many Reviews
// -------------------------------------------------------------
Vendor.hasMany(Review, { foreignKey: "vendorId" });
Review.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

// -------------------------------------------------------------
// OFFERING -> REVIEW
// 1 Offering receives many Reviews
// -------------------------------------------------------------
Offering.hasMany(Review, { foreignKey: "offeringId" });
Review.belongsTo(Offering, { foreignKey: "offeringId", as: "offering" });

// -------------------------------------------------------------
// ORDER -> REVIEW
// 1 Order has 0 or 1 Review
// -------------------------------------------------------------
Order.hasOne(Review, { foreignKey: "orderId", as: "review" });
Review.belongsTo(Order, { foreignKey: "orderId" });

export { User, Vendor, Category, Offering, Order, Review };
