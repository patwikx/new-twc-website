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
