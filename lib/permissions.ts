import { UserRole } from "@prisma/client";

export type Permission = 
  // Properties & Rooms
  | "properties:view"
  | "properties:create"
  | "properties:edit"
  | "properties:delete"
  | "rooms:view"
  | "rooms:create"
  | "rooms:edit"
  | "rooms:delete"
  // Bookings & Payments
  | "bookings:view"
  | "bookings:create"
  | "bookings:edit"
  | "bookings:cancel"
  | "payments:view"
  | "payments:refund"
  // Users & Membership
  | "users:view"
  | "users:edit"
  | "users:delete"
  | "membership:view"
  | "membership:manage"
  // Content (Experiences, FAQ, etc)
  | "content:view"
  | "content:create"
  | "content:edit"
  | "content:delete"
  // Marketing (Coupons, Newsletter)
  | "marketing:view"
  | "coupons:create"
  | "coupons:edit"
  | "coupons:delete"
  | "newsletter:view"
  | "newsletter:export"
  // Social (Reviews)
  | "reviews:view"
  | "reviews:moderate" // Delete or hide reviews
  // Analytics & System
  | "analytics:view"
  | "settings:view"
  | "settings:manage";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Full access to everything
  ADMIN: [
    "properties:view", "properties:create", "properties:edit", "properties:delete",
    "rooms:view", "rooms:create", "rooms:edit", "rooms:delete",
    "bookings:view", "bookings:create", "bookings:edit", "bookings:cancel",
    "payments:view", "payments:refund",
    "users:view", "users:edit", "users:delete",
    "membership:view", "membership:manage",
    "content:view", "content:create", "content:edit", "content:delete",
    "marketing:view", "coupons:create", "coupons:edit", "coupons:delete", 
    "newsletter:view", "newsletter:export",
    "reviews:view", "reviews:moderate",
    "analytics:view",
    "settings:view", "settings:manage"
  ],
  // Staff / Operational Role (Front Desk + Marketing Helper)
  STAFF: [
    // Can view but not change core property data
    "properties:view", 
    "rooms:view",      
    // Full control over bookings for day-to-day ops
    "bookings:view", "bookings:create", "bookings:edit", "bookings:cancel",
    "payments:view", // View payments but no refunds (Admin only)
    // Assist guests with membership issues
    "users:view", "users:edit", 
    "membership:view",
    // Content management for blog/experiences
    "content:view", "content:create", "content:edit",
    // View reviews
    "reviews:view"
  ],
  // Guests have NO admin permissions
  GUEST: []
};

// Helper type for checking
export type Role = UserRole;
