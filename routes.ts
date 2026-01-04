/**
 * An array of routes that are accessible to the public
 * These routes do not require authentication
 * @type {string[]}
 */
export const publicRoutes = [
  // Landing & Marketing Pages
  "/",
  "/about",
  "/careers",
  "/contact",
  "/dining",
  "/events",
  "/experiences",
  "/privacy",
  "/terms",
  
  // Property Browsing (public catalog)
  "/properties",
  
  // Booking Flow (guest checkout allowed)
  "/book",
  "/cart",
  "/payment/success",
  
  // Guest Booking Lookup (no auth required)
  "/bookings/lookup",
];

/**
 * An array of route prefixes that are accessible to the public
 * Any route starting with these prefixes does not require authentication
 * @type {string[]}
 */
export const publicRoutePrefixes = [
  // Property detail pages (dynamic routes)
  "/properties/",
  
  // Booking confirmation (accessible via ref/id)
  "/book/confirmation",
  
  // Guest booking lookup with token
  "/bookings/lookup/",
];

/**
 * An array of routes that are used for authentication
 * These routes will redirect logged in users to /
 * @type {string[]}
 */
export const authRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/reset",
  "/auth/new-password",
  "/auth/new-verification",
];

/**
 * The prefix for API authentication routes
 * Routes that start with this prefix are used for API authentication purposes
 * @type {string}
 */
export const apiAuthPrefix = "/api/auth";

/**
 * API routes that should be publicly accessible (no auth required)
 * @type {string[]}
 */
export const publicApiRoutes = [
  "/api/email",
  "/api/contact",
  "/api/newsletter",
  "/api/bookings/status",
  "/api/payments/create-checkout",
  "/api/webhooks/paymongo",
];

/**
 * The default redirect path after logging in
 * @type {string}
 */
export const DEFAULT_LOGIN_REDIRECT = "/";
