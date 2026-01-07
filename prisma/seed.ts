import { PrismaClient, UserRole, CouponType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================================
// PERMISSIONS DATA
// ============================================================================

const ROLE_PERMISSIONS = {
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
    "settings:view", "settings:manage",
    "inventory:view", "inventory:create", "inventory:edit", "inventory:delete",
    "pos:view", "pos:create", "pos:edit",
  ],
  STAFF: [
    "properties:view", "rooms:view",
    "bookings:view", "bookings:create", "bookings:edit", "bookings:cancel",
    "payments:view",
    "users:view", "users:edit",
    "membership:view",
    "content:view", "content:create", "content:edit",
    "reviews:view",
    "inventory:view",
    "pos:view", "pos:create",
  ],
  GUEST: []
};

// ============================================================================
// SEED DATA
// ============================================================================

const DEPARTMENTS = ["Executive", "Operations", "Finance", "HR", "IT", "Marketing", "F&B", "Housekeeping", "Front Office"];

const ROLES = [
  { name: "Super Admin", description: "Full system access. Cannot be deleted.", isSystem: true, permissions: ROLE_PERMISSIONS.ADMIN, legacyRole: "ADMIN" as UserRole },
  { name: "Staff", description: "Standard employee access.", isSystem: true, permissions: ROLE_PERMISSIONS.STAFF, legacyRole: "STAFF" as UserRole },
  { name: "Guest", description: "External user / Customer.", isSystem: true, permissions: ROLE_PERMISSIONS.GUEST, legacyRole: "GUEST" as UserRole },
];


const USERS = [
  { name: "System Administrator", email: "admin@twc.com", role: "ADMIN" as UserRole, phone: "+63 917 123 4567" },
  { name: "Staff User", email: "staff@twc.com", role: "STAFF" as UserRole, phone: "+63 917 987 6543" },
];

// ============================================================================
// PROPERTIES WITH 3 ROOM TYPES EACH
// ============================================================================

const PROPERTIES = [
  {
    slug: "anchor-hotel",
    name: "Anchor Hotel",
    location: "General Santos City, South Cotabato",
    description: "A sanctuary of modern luxury in the heart of GenSan.",
    longDescription: "Anchor Hotel represents the pinnacle of urban sophistication in General Santos City. Located in the vibrant city center, it offers immediate access to business districts and cultural landmarks.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop",
    taxRate: 0.12,
    serviceChargeRate: 0.10,
    rooms: [
      { name: "Standard Room", price: 2500, capacity: 2, description: "Comfortable room with essential amenities.", amenities: ["Wi-Fi", "Air Conditioning", "TV", "Hot Shower"], image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=2070&auto=format&fit=crop", sizeSqM: 22 },
      { name: "Deluxe Room", price: 3500, capacity: 2, description: "Spacious room with city views.", amenities: ["Wi-Fi", "Air Conditioning", "Smart TV", "Mini Bar", "City View", "Work Desk"], image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1974&auto=format&fit=crop", sizeSqM: 32 },
      { name: "Executive Suite", price: 6500, capacity: 4, description: "Premium suite with separate living area.", amenities: ["Wi-Fi", "Air Conditioning", "Smart TV", "Mini Bar", "Living Room", "Bath Tub", "Lounge Access"], image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1974&auto=format&fit=crop", sizeSqM: 55 },
    ],
    policies: [
      { title: "Check-in/Check-out", description: "Check-in: 2:00 PM | Check-out: 12:00 NN. Early check-in and late check-out subject to availability." },
      { title: "Cancellation Policy", description: "Free cancellation up to 24 hours before check-in. Cancellations within 24 hours will be charged one night's stay." },
      { title: "Payment Policy", description: "Full payment required at booking. We accept credit cards, debit cards, and bank transfers." },
    ],
  },
  {
    slug: "dolores-farm-resort",
    name: "Dolores Farm Resort",
    location: "Polomolok, South Cotabato",
    description: "Experience the rustic charm and tranquility of nature.",
    longDescription: "Dolores Farm Resort is your escape to the countryside. Surrounded by lush greenery and organic farms, it provides a unique farm-to-table experience.",
    image: "https://images.unsplash.com/photo-1587061949409-02df41d5b1d7?q=80&w=2070&auto=format&fit=crop",
    taxRate: 0.12,
    serviceChargeRate: 0.10,
    rooms: [
      { name: "Garden Cottage", price: 2200, capacity: 2, description: "Cozy cottage surrounded by gardens.", amenities: ["Wi-Fi", "Fan", "Private Porch", "Garden View"], image: "https://images.unsplash.com/photo-1449156493391-d2cfa28e468b?q=80&w=2074&auto=format&fit=crop", sizeSqM: 25 },
      { name: "Family Cabin", price: 3800, capacity: 4, description: "Spacious cabin perfect for families.", amenities: ["Wi-Fi", "Air Conditioning", "Kitchenette", "BBQ Area", "Parking"], image: "https://images.unsplash.com/photo-1585549696872-246e7f849004?q=80&w=2070&auto=format&fit=crop", sizeSqM: 45 },
      { name: "Farm Villa", price: 7500, capacity: 6, description: "Luxurious villa with full amenities.", amenities: ["Wi-Fi", "Air Conditioning", "Full Kitchen", "Private Pool", "BBQ Area", "Parking", "Farm Tour"], image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=2070&auto=format&fit=crop", sizeSqM: 85 },
    ],
    policies: [
      { title: "Check-in/Check-out", description: "Check-in: 2:00 PM | Check-out: 12:00 NN." },
      { title: "Cancellation Policy", description: "Free cancellation up to 48 hours before check-in." },
      { title: "Pet Policy", description: "Pets are welcome with prior arrangement. Additional cleaning fee may apply." },
    ],
  },
  {
    slug: "dolores-lake-resort",
    name: "Dolores Lake Resort",
    location: "Lake Sebu, South Cotabato",
    description: "Serene lakeside living with breathtaking sunsets.",
    longDescription: "Perched on the edge of the pristine Lake Sebu, this resort offers water sports, fishing, and relaxation. The perfect spot for water lovers.",
    image: "https://images.unsplash.com/photo-1499539347895-65471d80b5a3?q=80&w=2074&auto=format&fit=crop",
    taxRate: 0.12,
    serviceChargeRate: 0.10,
    rooms: [
      { name: "Lake View Room", price: 2800, capacity: 2, description: "Wake up to the sight of the calm lake.", amenities: ["Wi-Fi", "Air Conditioning", "Balcony", "Lake View"], image: "https://images.unsplash.com/photo-1560662105-57f8ad6ae2d1?q=80&w=2070&auto=format&fit=crop", sizeSqM: 28 },
      { name: "Floating Cottage", price: 4200, capacity: 4, description: "Unique floating cottage experience.", amenities: ["Wi-Fi", "Fan", "Fishing Deck", "Kayak Access", "Lake View"], image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop", sizeSqM: 35 },
      { name: "Lakeside Villa", price: 8500, capacity: 6, description: "Premium villa with private dock.", amenities: ["Wi-Fi", "Air Conditioning", "Full Kitchen", "Private Dock", "Boat Access", "BBQ Area"], image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop", sizeSqM: 90 },
    ],
    policies: [
      { title: "Check-in/Check-out", description: "Check-in: 2:00 PM | Check-out: 11:00 AM." },
      { title: "Water Activities", description: "Life jackets required for all water activities. Children must be supervised." },
      { title: "Cancellation Policy", description: "Free cancellation up to 72 hours before check-in due to weather considerations." },
    ],
  },
  {
    slug: "dolores-tropicana-resort",
    name: "Dolores Tropicana Resort",
    location: "Sarangani, South Cotabato",
    description: "The ultimate tropical paradise with pristine beaches.",
    longDescription: "Dolores Tropicana Resort is a sun-soaked paradise. With white sandy beaches, crystal clear waters, and palm trees, it is the ultimate vacation destination.",
    image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop",
    taxRate: 0.12,
    serviceChargeRate: 0.10,
    rooms: [
      { name: "Beach Room", price: 3500, capacity: 2, description: "Steps away from the beach.", amenities: ["Wi-Fi", "Air Conditioning", "Beach Access", "Ocean View"], image: "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?q=80&w=1974&auto=format&fit=crop", sizeSqM: 30 },
      { name: "Ocean View Suite", price: 5500, capacity: 3, description: "Panoramic ocean views.", amenities: ["Wi-Fi", "Air Conditioning", "Balcony", "Ocean View", "Mini Bar", "Bath Tub"], image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop", sizeSqM: 45 },
      { name: "Beachfront Villa", price: 12000, capacity: 6, description: "Private beachfront luxury.", amenities: ["Wi-Fi", "Air Conditioning", "Private Beach", "Private Pool", "Full Kitchen", "Butler Service"], image: "https://images.unsplash.com/photo-1439130490301-25e322d88054?q=80&w=2089&auto=format&fit=crop", sizeSqM: 120 },
    ],
    policies: [
      { title: "Check-in/Check-out", description: "Check-in: 3:00 PM | Check-out: 12:00 NN." },
      { title: "Beach Rules", description: "No glass containers on the beach. Respect marine life and coral reefs." },
      { title: "Cancellation Policy", description: "Free cancellation up to 7 days before check-in. 50% refund for cancellations within 7 days." },
    ],
  },
];


// ============================================================================
// UNITS OF MEASURE - Complete Set
// ============================================================================

const UNITS_OF_MEASURE = {
  // Base units (no conversion)
  base: [
    { name: "Kilogram", abbreviation: "kg" },
    { name: "Liter", abbreviation: "L" },
    { name: "Piece", abbreviation: "pc" },
    { name: "Meter", abbreviation: "m" },
  ],
  // Derived units (with conversion to base)
  derived: [
    { name: "Gram", abbreviation: "g", baseAbbr: "kg", factor: 0.001 },
    { name: "Milligram", abbreviation: "mg", baseAbbr: "kg", factor: 0.000001 },
    { name: "Milliliter", abbreviation: "mL", baseAbbr: "L", factor: 0.001 },
    { name: "Centiliter", abbreviation: "cL", baseAbbr: "L", factor: 0.01 },
    { name: "Dozen", abbreviation: "dz", baseAbbr: "pc", factor: 12 },
    { name: "Pack", abbreviation: "pk", baseAbbr: "pc", factor: 1 },
    { name: "Box", abbreviation: "bx", baseAbbr: "pc", factor: 1 },
    { name: "Case", abbreviation: "cs", baseAbbr: "pc", factor: 1 },
    { name: "Bottle", abbreviation: "btl", baseAbbr: "pc", factor: 1 },
    { name: "Can", abbreviation: "can", baseAbbr: "pc", factor: 1 },
    { name: "Bag", abbreviation: "bag", baseAbbr: "pc", factor: 1 },
    { name: "Roll", abbreviation: "roll", baseAbbr: "pc", factor: 1 },
    { name: "Sheet", abbreviation: "sht", baseAbbr: "pc", factor: 1 },
    { name: "Pair", abbreviation: "pr", baseAbbr: "pc", factor: 2 },
    { name: "Set", abbreviation: "set", baseAbbr: "pc", factor: 1 },
    { name: "Centimeter", abbreviation: "cm", baseAbbr: "m", factor: 0.01 },
    { name: "Gallon", abbreviation: "gal", baseAbbr: "L", factor: 3.785 },
    { name: "Ounce", abbreviation: "oz", baseAbbr: "kg", factor: 0.02835 },
    { name: "Pound", abbreviation: "lb", baseAbbr: "kg", factor: 0.4536 },
  ],
};

// ============================================================================
// STOCK CATEGORIES - Complete Set
// ============================================================================

const STOCK_CATEGORIES = [
  // Food & Beverage
  { name: "Dry Goods", description: "Rice, pasta, flour, sugar, and other dry ingredients", color: "amber", isSystem: true },
  { name: "Frozen Goods", description: "Frozen meats, seafood, and vegetables", color: "cyan", isSystem: true },
  { name: "Fresh Produce", description: "Fresh fruits and vegetables", color: "green", isSystem: true },
  { name: "Dairy & Eggs", description: "Milk, cheese, butter, and eggs", color: "yellow", isSystem: true },
  { name: "Meat & Poultry", description: "Fresh and processed meats", color: "red", isSystem: true },
  { name: "Seafood", description: "Fresh and frozen seafood", color: "blue", isSystem: true },
  { name: "Beverages", description: "Soft drinks, juices, and water", color: "sky", isSystem: true },
  { name: "Alcoholic Beverages", description: "Beer, wine, and spirits", color: "purple", isSystem: true },
  { name: "Condiments & Sauces", description: "Soy sauce, vinegar, oils, and seasonings", color: "orange", isSystem: true },
  { name: "Bakery Items", description: "Bread, pastries, and baked goods", color: "amber", isSystem: true },
  // Housekeeping
  { name: "Linens", description: "Bed sheets, towels, and table linens", color: "indigo", isSystem: true },
  { name: "Cleaning Supplies", description: "Detergents, disinfectants, and cleaning tools", color: "teal", isSystem: true },
  { name: "Guest Amenities", description: "Toiletries, slippers, and room supplies", color: "pink", isSystem: true },
  // Operations
  { name: "Office Supplies", description: "Paper, pens, and office materials", color: "slate", isSystem: true },
  { name: "Kitchen Equipment", description: "Cookware, utensils, and small equipment", color: "zinc", isSystem: true },
  { name: "Maintenance Supplies", description: "Tools, spare parts, and repair materials", color: "stone", isSystem: true },
  // Special
  { name: "Consignment", description: "Supplier-owned items for resale", color: "violet", isSystem: true },
];


// ============================================================================
// COUPONS
// ============================================================================

const COUPONS = [
  { code: "WELCOME10", type: CouponType.PERCENTAGE, value: 10, description: "10% off your first booking" },
  { code: "SUMMER500", type: CouponType.FIXED_AMOUNT, value: 500, description: "₱500 off for summer bookings" },
];

// ============================================================================
// EXPERIENCES
// ============================================================================

const EXPERIENCES = [
  { title: "Seven Falls of Lake Sebu", description: "Marvel at the majestic seven waterfalls connected by a thrilling zipline adventure.", image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=2070&auto=format&fit=crop", category: "Nature", distance: "45 min from Dolores Lake Resort" },
  { title: "T'boli Cultural Village", description: "Immerse yourself in the rich heritage of the T'boli tribe.", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=2064&auto=format&fit=crop", category: "Culture", distance: "30 min from Dolores Lake Resort" },
  { title: "General Santos Fish Port", description: "Witness the bustling activity of the Tuna Capital of the Philippines.", image: "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?q=80&w=2069&auto=format&fit=crop", category: "Food", distance: "10 min from Anchor Hotel" },
  { title: "Mount Matutum Trek", description: "Conquer the summit of this majestic stratovolcano.", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop", category: "Adventure", distance: "1 hr from Dolores Farm Resort" },
  { title: "Sarangani Bay Island Hopping", description: "Explore pristine islands and snorkel in crystal-clear waters.", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop", category: "Adventure", distance: "20 min from Dolores Tropicana Resort" },
];

// ============================================================================
// MENU CATEGORIES
// ============================================================================

const MENU_CATEGORIES = [
  { name: "Appetizers", description: "Start your meal with these delicious starters", color: "green", icon: "Salad", sortOrder: 1 },
  { name: "Soups & Salads", description: "Fresh and healthy options", color: "cyan", icon: "Salad", sortOrder: 2 },
  { name: "Main Course", description: "Hearty main dishes", color: "orange", icon: "UtensilsCrossed", sortOrder: 3 },
  { name: "Pasta & Rice", description: "Carb-loaded favorites", color: "yellow", icon: "Pizza", sortOrder: 4 },
  { name: "Grilled & BBQ", description: "Fire-grilled specialties", color: "red", icon: "UtensilsCrossed", sortOrder: 5 },
  { name: "Seafood", description: "Fresh catch from the sea", color: "blue", icon: "UtensilsCrossed", sortOrder: 6 },
  { name: "Desserts", description: "Sweet endings", color: "pink", icon: "IceCream", sortOrder: 7 },
  { name: "Beverages", description: "Refreshing drinks", color: "cyan", icon: "Coffee", sortOrder: 8 },
  { name: "Coffee & Tea", description: "Hot and iced beverages", color: "purple", icon: "Coffee", sortOrder: 9 },
  { name: "Alcoholic Drinks", description: "Beer, wine, and cocktails", color: "purple", icon: "Wine", sortOrder: 10 },
];

// ============================================================================
// MENU ITEMS - Organized by category with images
// ============================================================================

const MENU_ITEMS = {
  "Appetizers": [
    { name: "Crispy Calamari", description: "Deep-fried squid rings served with garlic aioli", price: 285, hasRecipe: true, image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop" },
    { name: "Nachos Supreme", description: "Corn chips topped with cheese, jalapeños, salsa, and sour cream", price: 245, hasRecipe: true, image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop" },
    { name: "Spring Rolls", description: "Crispy vegetable spring rolls with sweet chili sauce", price: 165, hasRecipe: true, image: "https://images.unsplash.com/photo-1548507200-d6b2e9a95e89?w=400&h=300&fit=crop" },
    { name: "Chicken Wings", description: "Crispy buffalo wings with blue cheese dip", price: 295, hasRecipe: true, image: "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=400&h=300&fit=crop" },
    { name: "Garlic Bread", description: "Toasted baguette with garlic butter and herbs", price: 95, hasRecipe: true, image: "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=400&h=300&fit=crop" },
  ],
  "Soups & Salads": [
    { name: "Caesar Salad", description: "Romaine lettuce, parmesan, croutons with caesar dressing", price: 225, hasRecipe: true, image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&h=300&fit=crop" },
    { name: "Cream of Mushroom Soup", description: "Rich and creamy mushroom soup", price: 145, hasRecipe: true, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop" },
    { name: "Garden Salad", description: "Fresh mixed greens with balsamic vinaigrette", price: 185, hasRecipe: false, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop" },
    { name: "Sinigang na Hipon", description: "Traditional sour soup with shrimp and vegetables", price: 295, hasRecipe: true, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop" },
  ],
  "Main Course": [
    { name: "Grilled Salmon", description: "Atlantic salmon with lemon butter sauce and vegetables", price: 485, hasRecipe: true, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop" },
    { name: "Chicken Cordon Bleu", description: "Breaded chicken stuffed with ham and cheese", price: 365, hasRecipe: true, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop" },
    { name: "Beef Steak", description: "200g ribeye steak with mushroom gravy", price: 595, hasRecipe: true, image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop" },
    { name: "Pork Belly Lechon", description: "Crispy roasted pork belly with liver sauce", price: 385, hasRecipe: true, image: "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=400&h=300&fit=crop" },
    { name: "Fish and Chips", description: "Beer-battered fish fillet with fries and tartar sauce", price: 345, hasRecipe: true, image: "https://images.unsplash.com/photo-1579208030886-b937da0925dc?w=400&h=300&fit=crop" },
  ],
  "Pasta & Rice": [
    { name: "Carbonara", description: "Creamy pasta with bacon and parmesan", price: 265, hasRecipe: true, image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop" },
    { name: "Beef Lasagna", description: "Layered pasta with beef ragu and bechamel", price: 295, hasRecipe: true, image: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400&h=300&fit=crop" },
    { name: "Garlic Fried Rice", description: "Aromatic fried rice with garlic chips", price: 95, hasRecipe: true, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop" },
    { name: "Yangchow Fried Rice", description: "Classic Chinese fried rice with shrimp and ham", price: 185, hasRecipe: true, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop" },
    { name: "Spaghetti Bolognese", description: "Pasta with Italian meat sauce", price: 245, hasRecipe: true, image: "https://images.unsplash.com/photo-1626844131282-9a2e648b5b95?w=400&h=300&fit=crop" },
  ],
  "Grilled & BBQ": [
    { name: "BBQ Pork Ribs", description: "Full rack of tender pork ribs with BBQ sauce", price: 495, hasRecipe: true, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop" },
    { name: "Grilled Chicken", description: "Half chicken marinated in herbs and spices", price: 325, hasRecipe: true, image: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop" },
    { name: "Mixed Grill Platter", description: "Assorted grilled meats for sharing", price: 895, hasRecipe: false, image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop" },
    { name: "Inihaw na Liempo", description: "Filipino-style grilled pork belly", price: 285, hasRecipe: true, image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop" },
  ],
  "Seafood": [
    { name: "Grilled Tuna Belly", description: "Fresh tuna belly with garlic rice", price: 425, hasRecipe: true, image: "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=400&h=300&fit=crop" },
    { name: "Butter Garlic Shrimp", description: "Prawns sautéed in butter and garlic", price: 385, hasRecipe: true, image: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=300&fit=crop" },
    { name: "Crispy Pata", description: "Deep-fried pork leg served with soy-vinegar dip", price: 595, hasRecipe: true, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop" },
    { name: "Kare-Kare", description: "Traditional oxtail stew in peanut sauce", price: 445, hasRecipe: true, image: "https://images.unsplash.com/photo-1547928576-b822bc410e41?w=400&h=300&fit=crop" },
  ],
  "Desserts": [
    { name: "Halo-Halo", description: "Filipino shaved ice with mixed toppings", price: 145, hasRecipe: false, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop" },
    { name: "Leche Flan", description: "Creamy caramel custard", price: 95, hasRecipe: true, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
    { name: "Chocolate Lava Cake", description: "Warm chocolate cake with molten center", price: 175, hasRecipe: true, image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop" },
    { name: "Mango Float", description: "Layered graham, cream, and ripe mangoes", price: 125, hasRecipe: true, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&h=300&fit=crop" },
    { name: "Buko Pandan", description: "Coconut and pandan jelly dessert", price: 85, hasRecipe: true, image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
  ],
  "Beverages": [
    { name: "Iced Tea", description: "House-brewed iced tea", price: 55, hasRecipe: false, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop" },
    { name: "Calamansi Juice", description: "Fresh Philippine lime juice", price: 65, hasRecipe: false, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop" },
    { name: "Mango Shake", description: "Fresh mango blended with ice", price: 95, hasRecipe: false, image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=300&fit=crop" },
    { name: "Soft Drinks", description: "Coke, Sprite, or Royal", price: 45, hasRecipe: false, image: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=300&fit=crop" },
    { name: "Bottled Water", description: "500ml purified water", price: 35, hasRecipe: false, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop" },
    { name: "Fresh Buko Juice", description: "Refreshing young coconut water", price: 75, hasRecipe: false, image: "https://images.unsplash.com/photo-1536657464919-892534f60d6e?w=400&h=300&fit=crop" },
  ],
  "Coffee & Tea": [
    { name: "Brewed Coffee", description: "Freshly brewed local coffee", price: 85, hasRecipe: false, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop" },
    { name: "Cappuccino", description: "Espresso with steamed milk foam", price: 125, hasRecipe: false, image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop" },
    { name: "Café Latte", description: "Espresso with steamed milk", price: 115, hasRecipe: false, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop" },
    { name: "Hot Chocolate", description: "Rich and creamy hot cocoa", price: 95, hasRecipe: false, image: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&h=300&fit=crop" },
    { name: "Green Tea", description: "Japanese green tea", price: 75, hasRecipe: false, image: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=400&h=300&fit=crop" },
  ],
  "Alcoholic Drinks": [
    { name: "San Miguel Pale Pilsen", description: "Local beer 330ml", price: 85, hasRecipe: false, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=300&fit=crop" },
    { name: "San Miguel Light", description: "Light beer 330ml", price: 85, hasRecipe: false, image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop" },
    { name: "Red Horse", description: "Strong beer 500ml", price: 95, hasRecipe: false, image: "https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=400&h=300&fit=crop" },
    { name: "House Red Wine", description: "Glass of red wine", price: 185, hasRecipe: false, image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop" },
    { name: "House White Wine", description: "Glass of white wine", price: 185, hasRecipe: false, image: "https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=400&h=300&fit=crop" },
    { name: "Margarita", description: "Classic tequila cocktail", price: 225, hasRecipe: false, image: "https://images.unsplash.com/photo-1556855810-ac404aa91e85?w=400&h=300&fit=crop" },
  ],
};

// ============================================================================
// RECIPES - Simple recipes for items that have hasRecipe: true
// ============================================================================

const RECIPES = [
  {
    name: "Crispy Calamari",
    description: "Deep-fried squid rings with seasoned batter",
    yield: 1,
    yieldUnit: "pc",
    prepTimeMinutes: 15,
    cookTimeMinutes: 5,
    instructions: "1. Clean and slice squid into rings. 2. Dredge in seasoned flour. 3. Deep fry at 180°C until golden. 4. Serve with garlic aioli.",
    ingredients: [
      { name: "Squid", quantity: 200, unit: "g" },
      { name: "All-purpose Flour", quantity: 100, unit: "g" },
      { name: "Cooking Oil", quantity: 500, unit: "mL" },
    ],
  },
  {
    name: "Caesar Salad",
    description: "Classic caesar salad with homemade dressing",
    yield: 1,
    yieldUnit: "pc",
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    instructions: "1. Wash and chop romaine lettuce. 2. Add croutons and parmesan. 3. Toss with caesar dressing.",
    ingredients: [
      { name: "Romaine Lettuce", quantity: 150, unit: "g" },
      { name: "Parmesan Cheese", quantity: 30, unit: "g" },
      { name: "Caesar Dressing", quantity: 50, unit: "mL" },
    ],
  },
  {
    name: "Carbonara",
    description: "Creamy Italian pasta with bacon",
    yield: 1,
    yieldUnit: "pc",
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    instructions: "1. Cook pasta al dente. 2. Fry bacon until crispy. 3. Mix eggs with parmesan. 4. Combine all with pasta, stirring off heat.",
    ingredients: [
      { name: "Spaghetti Pasta", quantity: 120, unit: "g" },
      { name: "Bacon", quantity: 50, unit: "g" },
      { name: "Egg", quantity: 2, unit: "pc" },
      { name: "Parmesan Cheese", quantity: 40, unit: "g" },
      { name: "Heavy Cream", quantity: 50, unit: "mL" },
    ],
  },
  {
    name: "Leche Flan",
    description: "Filipino caramel custard",
    yield: 6,
    yieldUnit: "pc",
    prepTimeMinutes: 20,
    cookTimeMinutes: 45,
    instructions: "1. Make caramel with sugar. 2. Mix eggs, milk, and vanilla. 3. Pour over caramel. 4. Steam for 45 minutes.",
    ingredients: [
      { name: "Egg", quantity: 10, unit: "pc" },
      { name: "Condensed Milk", quantity: 1, unit: "can" },
      { name: "Evaporated Milk", quantity: 1, unit: "can" },
      { name: "White Sugar", quantity: 150, unit: "g" },
    ],
  },
  {
    name: "Grilled Tuna Belly",
    description: "Fresh tuna belly grilled to perfection",
    yield: 1,
    yieldUnit: "pc",
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    instructions: "1. Marinate tuna in soy sauce and calamansi. 2. Grill on high heat for 5 minutes per side. 3. Serve with garlic rice.",
    ingredients: [
      { name: "Tuna Belly", quantity: 200, unit: "g" },
      { name: "Soy Sauce", quantity: 30, unit: "mL" },
      { name: "Calamansi", quantity: 3, unit: "pc" },
      { name: "Garlic", quantity: 5, unit: "g" },
    ],
  },
  {
    name: "Garlic Fried Rice",
    description: "Aromatic fried rice with crispy garlic",
    yield: 1,
    yieldUnit: "pc",
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    instructions: "1. Fry minced garlic until golden. 2. Add day-old rice and stir-fry. 3. Season with salt.",
    ingredients: [
      { name: "Cooked Rice", quantity: 200, unit: "g" },
      { name: "Garlic", quantity: 20, unit: "g" },
      { name: "Cooking Oil", quantity: 30, unit: "mL" },
      { name: "Salt", quantity: 2, unit: "g" },
    ],
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log("🌱 Starting database seed...\n");

  // -------------------------------------------------------------------------
  // 1. DEPARTMENTS
  // -------------------------------------------------------------------------
  console.log("📁 Seeding Departments...");
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`   ✅ ${DEPARTMENTS.length} departments created.\n`);

  // -------------------------------------------------------------------------
  // 2. ROLES
  // -------------------------------------------------------------------------
  console.log("🛡️  Seeding Roles...");
  const roleMap: Record<string, string> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions, description: r.description },
      create: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.permissions,
      },
    });
    roleMap[r.name] = role.id;
  }
  console.log(`   ✅ ${ROLES.length} roles created.\n`);


  // -------------------------------------------------------------------------
  // 3. USERS
  // -------------------------------------------------------------------------
  console.log("👤 Seeding Users...");
  const hashedPassword = await bcrypt.hash("Password123!", 10);
  for (const u of USERS) {
    const roleName = u.role === "ADMIN" ? "Super Admin" : u.role === "STAFF" ? "Staff" : "Guest";
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, phone: u.phone },
      create: {
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        roleId: roleMap[roleName],
        phone: u.phone,
        status: "ACTIVE",
        emailVerified: new Date(),
      },
    });
  }
  console.log(`   ✅ ${USERS.length} users created.\n`);

  // -------------------------------------------------------------------------
  // 4. UNITS OF MEASURE
  // -------------------------------------------------------------------------
  console.log("📏 Seeding Units of Measure...");
  const unitMap: Record<string, string> = {};
  
  // Create base units first
  for (const unit of UNITS_OF_MEASURE.base) {
    const created = await prisma.unitOfMeasure.upsert({
      where: { abbreviation: unit.abbreviation },
      update: { name: unit.name },
      create: {
        name: unit.name,
        abbreviation: unit.abbreviation,
        conversionFactor: 1,
        baseUnitId: null,
      },
    });
    unitMap[unit.abbreviation] = created.id;
  }
  
  // Create derived units
  for (const unit of UNITS_OF_MEASURE.derived) {
    await prisma.unitOfMeasure.upsert({
      where: { abbreviation: unit.abbreviation },
      update: { name: unit.name, conversionFactor: unit.factor, baseUnitId: unitMap[unit.baseAbbr] },
      create: {
        name: unit.name,
        abbreviation: unit.abbreviation,
        conversionFactor: unit.factor,
        baseUnitId: unitMap[unit.baseAbbr],
      },
    });
  }
  console.log(`   ✅ ${UNITS_OF_MEASURE.base.length + UNITS_OF_MEASURE.derived.length} units created.\n`);

  // -------------------------------------------------------------------------
  // 5. STOCK CATEGORIES
  // -------------------------------------------------------------------------
  console.log("📦 Seeding Stock Categories...");
  for (const cat of STOCK_CATEGORIES) {
    await prisma.stockCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color },
      create: {
        name: cat.name,
        description: cat.description,
        color: cat.color,
        isSystem: cat.isSystem,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ ${STOCK_CATEGORIES.length} stock categories created.\n`);


  // -------------------------------------------------------------------------
  // 6. PROPERTIES, ROOMS, POLICIES
  // -------------------------------------------------------------------------
  console.log("🏨 Seeding Properties & Rooms...");
  let totalRooms = 0;

  for (const p of PROPERTIES) {
    // Upsert Property with tax and service charge rates
    const property = await prisma.property.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        location: p.location,
        description: p.description,
        longDescription: p.longDescription,
        image: p.image,
        taxRate: p.taxRate,
        serviceChargeRate: p.serviceChargeRate,
      },
      create: {
        slug: p.slug,
        name: p.name,
        location: p.location,
        description: p.description,
        longDescription: p.longDescription,
        image: p.image,
        taxRate: p.taxRate,
        serviceChargeRate: p.serviceChargeRate,
      },
    });

    // Upsert Policies
    if (p.policies) {
      // Delete existing policies and recreate
      await prisma.propertyPolicy.deleteMany({ where: { propertyId: property.id } });
      for (const policy of p.policies) {
        await prisma.propertyPolicy.create({
          data: {
            propertyId: property.id,
            title: policy.title,
            description: policy.description,
          },
        });
      }
    }

    // Upsert Rooms
    for (const r of p.rooms) {
      const roomId = `${property.id}-${r.name.toLowerCase().replace(/\s+/g, "-")}`;
      await prisma.room.upsert({
        where: { id: roomId },
        update: {
          name: r.name,
          description: r.description,
          capacity: r.capacity,
          price: r.price,
          sizeSqM: r.sizeSqM || null,
          image: r.image,
          amenities: r.amenities,
        },
        create: {
          id: roomId,
          propertyId: property.id,
          name: r.name,
          description: r.description,
          capacity: r.capacity,
          price: r.price,
          sizeSqM: r.sizeSqM || null,
          image: r.image,
          amenities: r.amenities,
        },
      });
      totalRooms++;
    }
  }
  console.log(`   ✅ ${PROPERTIES.length} properties and ${totalRooms} rooms created.\n`);

  // -------------------------------------------------------------------------
  // 7. EXPERIENCES
  // -------------------------------------------------------------------------
  console.log("🌴 Seeding Experiences...");
  for (const e of EXPERIENCES) {
    const expId = e.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    await prisma.experience.upsert({
      where: { id: expId },
      update: { title: e.title, description: e.description, category: e.category, image: e.image, distance: e.distance },
      create: { id: expId, title: e.title, description: e.description, category: e.category, image: e.image, distance: e.distance },
    });
  }
  console.log(`   ✅ ${EXPERIENCES.length} experiences created.\n`);


  // -------------------------------------------------------------------------
  // 8. COUPONS
  // -------------------------------------------------------------------------
  console.log("🎟️  Seeding Coupons...");
  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { type: c.type, value: c.value, description: c.description },
      create: { code: c.code, type: c.type, value: c.value, description: c.description, isActive: true },
    });
  }
  console.log(`   ✅ ${COUPONS.length} coupons created.\n`);

  // -------------------------------------------------------------------------
  // 9. MENU CATEGORIES (Global - available to all properties)
  // -------------------------------------------------------------------------
  console.log("🍽️  Seeding Menu Categories...");
  const categoryMap: Record<string, string> = {};
  for (const cat of MENU_CATEGORIES) {
    // Use composite unique constraint: propertyId + name (null + name for global)
    const existing = await prisma.menuCategory.findFirst({
      where: { propertyId: null, name: cat.name },
    });
    
    if (existing) {
      await prisma.menuCategory.update({
        where: { id: existing.id },
        data: { description: cat.description, color: cat.color, icon: cat.icon, sortOrder: cat.sortOrder },
      });
      categoryMap[cat.name] = existing.id;
    } else {
      const created = await prisma.menuCategory.create({
        data: {
          name: cat.name,
          description: cat.description,
          color: cat.color,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          propertyId: null, // Global category
          isActive: true,
        },
      });
      categoryMap[cat.name] = created.id;
    }
  }
  console.log(`   ✅ ${MENU_CATEGORIES.length} menu categories created.\n`);

  // -------------------------------------------------------------------------
  // 10. RECIPES
  // -------------------------------------------------------------------------
  console.log("👨‍🍳 Seeding Recipes...");
  const recipeMap: Record<string, string> = {};
  for (const recipe of RECIPES) {
    // Get unit ID
    const yieldUnit = await prisma.unitOfMeasure.findFirst({
      where: { abbreviation: recipe.yieldUnit },
    });
    
    if (!yieldUnit) {
      console.log(`   ⚠️ Unit ${recipe.yieldUnit} not found, skipping recipe ${recipe.name}`);
      continue;
    }
    
    const existing = await prisma.recipe.findFirst({
      where: { name: recipe.name },
    });
    
    if (existing) {
      recipeMap[recipe.name] = existing.id;
      continue; // Skip if already exists
    }
    
    const created = await prisma.recipe.create({
      data: {
        name: recipe.name,
        description: recipe.description,
        yield: recipe.yield,
        yieldUnitId: yieldUnit.id,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        instructions: recipe.instructions,
        isActive: true,
        minimumServingsThreshold: 5,
      },
    });
    recipeMap[recipe.name] = created.id;
  }
  console.log(`   ✅ ${RECIPES.length} recipes created.\n`);

  // -------------------------------------------------------------------------
  // 11. MENU ITEMS (Created for each property)
  // -------------------------------------------------------------------------
  console.log("🍔 Seeding Menu Items...");
  let totalMenuItems = 0;
  
  // Get all properties
  const allProperties = await prisma.property.findMany({ select: { id: true, name: true } });
  
  for (const property of allProperties) {
    for (const [categoryName, items] of Object.entries(MENU_ITEMS)) {
      const categoryId = categoryMap[categoryName];
      if (!categoryId) {
        console.log(`   ⚠️ Category ${categoryName} not found, skipping items`);
        continue;
      }
      
      for (const item of items) {
        // Check if menu item already exists for this property
        const existing = await prisma.menuItem.findFirst({
          where: { propertyId: property.id, name: item.name },
        });
        
        // Get recipe ID if applicable
        const recipeId = item.hasRecipe && recipeMap[item.name] ? recipeMap[item.name] : null;

        if (existing) {
          // Update existing item with image if provided
          if (item.image) {
             await prisma.menuItem.update({
               where: { id: existing.id },
               data: { imageUrl: item.image, recipeId: recipeId },
             });
          }
        } else {
          await prisma.menuItem.create({
            data: {
              propertyId: property.id,
              categoryId: categoryId,
              name: item.name,
              description: item.description,
              sellingPrice: item.price,
              recipeId: recipeId,
              imageUrl: item.image || null,
              isAvailable: true,
            },
          });
          totalMenuItems++;
        }
      }
    }
  }
  console.log(`   ✅ ${totalMenuItems} menu items created across ${allProperties.length} properties.\n`);

  // -------------------------------------------------------------------------
  // DONE
  // -------------------------------------------------------------------------
  console.log("🎉 Database seeding complete!");
  console.log("\n📋 Summary:");
  console.log(`   • ${DEPARTMENTS.length} departments`);
  console.log(`   • ${ROLES.length} roles`);
  console.log(`   • ${USERS.length} users`);
  console.log(`   • ${UNITS_OF_MEASURE.base.length + UNITS_OF_MEASURE.derived.length} units of measure`);
  console.log(`   • ${STOCK_CATEGORIES.length} stock categories`);
  console.log(`   • ${PROPERTIES.length} properties with ${totalRooms} rooms`);
  console.log(`   • ${EXPERIENCES.length} experiences`);
  console.log(`   • ${COUPONS.length} coupons`);
  console.log(`   • ${MENU_CATEGORIES.length} menu categories`);
  console.log(`   • ${RECIPES.length} recipes`);
  console.log(`   • ${totalMenuItems} menu items`);
  console.log("\n🔐 Default login: admin@twc.com / Password123!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
