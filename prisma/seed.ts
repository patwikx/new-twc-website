import { PrismaClient, UserRole, CouponType, MembershipTier } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedUnits } from "./seed-units";

const prisma = new PrismaClient();

// ============================================================================
// PERMISSIONS DATA (Inline to avoid path alias issues during seed)
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
    "settings:view", "settings:manage"
  ],
  STAFF: [
    "properties:view", "rooms:view",
    "bookings:view", "bookings:create", "bookings:edit", "bookings:cancel",
    "payments:view",
    "users:view", "users:edit", 
    "membership:view",
    "content:view", "content:create", "content:edit",
    "reviews:view"
  ],
  GUEST: []
};

// ============================================================================
// SEED DATA
// ============================================================================

const DEPARTMENTS = ["Executive", "Operations", "Finance", "HR", "IT", "Marketing"];

const ROLES = [
  { name: "Super Admin", description: "Full system access. Cannot be deleted.", isSystem: true, permissions: ROLE_PERMISSIONS.ADMIN, legacyRole: "ADMIN" as UserRole },
  { name: "Staff", description: "Standard employee access.", isSystem: true, permissions: ROLE_PERMISSIONS.STAFF, legacyRole: "STAFF" as UserRole },
  { name: "Guest", description: "External user / Customer.", isSystem: true, permissions: ROLE_PERMISSIONS.GUEST, legacyRole: "GUEST" as UserRole },
  { name: "Manager", description: "Team lead with approval capabilities.", isSystem: false, permissions: [...ROLE_PERMISSIONS.STAFF, "users:view", "reports:view"], legacyRole: null },
];

const USERS = [
  { name: "Patrick Miranda", email: "admin@twc.com", role: "ADMIN" as UserRole, phone: "+63 917 123 4567" },
  { name: "Staff User", email: "staff@twc.com", role: "STAFF" as UserRole, phone: "+63 917 987 6543" },
  { name: "Guest User", email: "guest@twc.com", role: "GUEST" as UserRole, phone: "+63 917 555 1234" },
];

const PROPERTIES = [
  {
    slug: "anchor-hotel",
    name: "Anchor Hotel",
    location: "General Santos City, South Cotabato",
    description: "A sanctuary of modern luxury in the heart of GenSan.",
    longDescription: "Anchor Hotel represents the pinnacle of urban sophistication in General Santos City. Located in the vibrant city center, it offers immediate access to business districts and cultural landmarks. Our design philosophy merges contemporary aesthetics with timeless comfort.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVjmCl56J2aSpFg1cK04bxM5IZTu7s6YJGtEdr",
    facebookPageId: "100083282241697",
    gallery: [
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1974&auto=format&fit=crop"
    ],
    rooms: [
      { name: "Standard City View", price: 3500, capacity: 2, description: "Elegant room with stunning views of General Santos.", amenities: ["Wi-Fi", "Smart TV", "Mini Bar", "City View"], image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=2070&auto=format&fit=crop", sizeSqM: 28 },
      { name: "Executive Suite", price: 8500, capacity: 3, description: "Spacious suite for the business traveler.", amenities: ["Wi-Fi", "Workspace", "Lounge Access", "Bath Tub"], image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1974&auto=format&fit=crop", sizeSqM: 55 },
    ],
    floorPlan: {
      imageUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop",
      hotspots: [
        { label: "Grand Lobby", type: "lobby", description: "Our stunning double-height lobby welcomes you with contemporary Filipino design elements.", x: 50, y: 85 },
        { label: "Cafe Rodrigo", type: "restaurant", description: "Award-winning dining experience featuring farm-to-table cuisine.", x: 25, y: 70 },
        { label: "Fitness Center", type: "gym", description: "State-of-the-art equipment available 24/7 for our guests.", x: 75, y: 70 },
        { label: "Infinity Pool", type: "pool", description: "Rooftop infinity pool with panoramic city views.", x: 50, y: 25 },
      ],
    },
  },
  {
    slug: "dolores-farm-resort",
    name: "Dolores Farm Resort",
    location: "Polomolok, South Cotabato",
    description: "Experience the rustic charm and tranquility of nature.",
    longDescription: "Dolores Farm Resort is your escape to the countryside. Surrounded by lush greenery and organic farms, it provides a unique farm-to-table experience and a peaceful retreat just outside the city.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVCbuJsLAK38AKlBqGNT7RI5pYizjQHwtvsrfV",
    facebookPageId: "123456789012345",
    gallery: [
      "https://images.unsplash.com/photo-1587061949409-02df41d5b1d7?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?q=80&w=2074&auto=format&fit=crop"
    ],
    rooms: [
      { name: "Rustic Cabin", price: 2800, capacity: 4, description: "Cozy wooden cabin surrounded by nature.", amenities: ["Porch", "Fireplace", "Kitchenette"], image: "https://images.unsplash.com/photo-1449156493391-d2cfa28e468b?q=80&w=2074&auto=format&fit=crop", sizeSqM: 35 },
      { name: "Garden Villa", price: 6500, capacity: 6, description: "Large villa perfect for families.", amenities: ["Private Garden", "BBQ Area", "Full Kitchen"], image: "https://images.unsplash.com/photo-1585549696872-246e7f849004?q=80&w=2070&auto=format&fit=crop", sizeSqM: 80 },
    ],
  },
  {
    slug: "dolores-lake-resort",
    name: "Dolores Lake Resort",
    location: "Lake Sebu, South Cotabato",
    description: "Serene lakeside living with breathtaking sunsets.",
    longDescription: "Perched on the edge of the pristine Lake Sebu, this resort offers water sports, fishing, and relaxation. The perfect spot for water lovers and those seeking a calm, aquatic atmosphere.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVRlnPT0iBg1ydiaq5LNXQVuEso6hCczW2ejlw",
    gallery: [
      "https://images.unsplash.com/photo-1499539347895-65471d80b5a3?q=80&w=2074&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop"
    ],
    rooms: [
      { name: "Lake View Room", price: 4200, capacity: 2, description: "Wake up to the sight of the calm lake.", amenities: ["Balcony", "Lake View", "King Bed"], image: "https://images.unsplash.com/photo-1560662105-57f8ad6ae2d1?q=80&w=2070&auto=format&fit=crop", sizeSqM: 32 },
    ],
  },
  {
    slug: "dolores-tropicana-resort",
    name: "Dolores Tropicana Resort",
    location: "General Santos City, South Cotabato",
    description: "The ultimate tropical paradise with pristine beaches.",
    longDescription: "Dolores Tropicana Resort is a sun-soaked paradise. With white sandy beaches, crystal clear waters, and palm trees, it is the ultimate vacation destination for sun seekers.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVNT0qvt8SmBCpIXnj3hsr7gFYc6i9oefMHUEv",
    gallery: [
      "https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?q=80&w=1974&auto=format&fit=crop"
    ],
    rooms: [
      { name: "Beachfront Bungalow", price: 9500, capacity: 2, description: "Steps away from the ocean.", amenities: ["Direct Beach Access", "Private Pool", "Outdoor Shower"], image: "https://images.unsplash.com/photo-1439130490301-25e322d88054?q=80&w=2089&auto=format&fit=crop", sizeSqM: 45 },
    ],
  },
];

const EXPERIENCES = [
  { title: "Seven Falls of Lake Sebu", description: "Marvel at the majestic seven waterfalls connected by a thrilling zipline adventure. A must-see natural wonder in the heart of South Cotabato.", image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=2070&auto=format&fit=crop", category: "Nature", distance: "45 min from Dolores Lake Resort" },
  { title: "T'boli Cultural Village", description: "Immerse yourself in the rich heritage of the T'boli tribe. Experience traditional weaving, music, and dance performances.", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=2064&auto=format&fit=crop", category: "Culture", distance: "30 min from Dolores Lake Resort" },
  { title: "General Santos Fish Port", description: "Witness the bustling activity of the Tuna Capital of the Philippines. Sample the freshest sashimi straight from the ocean.", image: "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?q=80&w=2069&auto=format&fit=crop", category: "Food", distance: "10 min from Anchor Hotel" },
  { title: "Mount Matutum Trek", description: "Conquer the summit of this majestic stratovolcano and be rewarded with breathtaking views of Sarangani Bay and surrounding provinces.", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop", category: "Adventure", distance: "1 hr from Dolores Farm Resort" },
  { title: "Traditional Hilot Massage", description: "Experience the ancient Filipino art of healing. Our partner spas offer authentic Hilot treatments using locally-sourced oils and herbs.", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070&auto=format&fit=crop", category: "Wellness", distance: "Available at all properties" },
  { title: "Sarangani Bay Island Hopping", description: "Explore pristine islands, snorkel in crystal-clear waters, and enjoy a beach barbecue under the sun.", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop", category: "Adventure", distance: "20 min from Dolores Tropicana Resort" },
  { title: "Dole Pineapple Plantation Tour", description: "Take a guided tour through one of the world's largest pineapple plantations and taste the sweetest pineapples on earth.", image: "https://images.unsplash.com/photo-1490885578174-acda8905c2c6?q=80&w=2069&auto=format&fit=crop", category: "Nature", distance: "15 min from Dolores Farm Resort" },
  { title: "GenSan Food Crawl", description: "A curated culinary journey through General Santos City's best kept secrets – from grilled tuna belly to local delicacies.", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2087&auto=format&fit=crop", category: "Food", distance: "Various locations" },
];

const COUPONS = [
  { code: "WELCOME10", type: CouponType.PERCENTAGE, value: 10, description: "10% off your first booking" },
  { code: "SUMMER500", type: CouponType.FIXED_AMOUNT, value: 500, description: "₱500 off for summer bookings" },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log("🌱 Starting comprehensive database seed...\n");

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
  const roleMap: Record<string, string> = {}; // name -> id
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

    // Migrate existing users with legacy role
    if (r.legacyRole) {
      const migrated = await prisma.user.updateMany({
        where: { role: r.legacyRole, roleId: null },
        data: { roleId: role.id },
      });
      if (migrated.count > 0) {
        console.log(`   📦 Migrated ${migrated.count} users from ${r.legacyRole} to ${r.name}`);
      }
    }
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
  // 4. PROPERTIES, ROOMS, IMAGES, AMENITIES, FLOOR PLANS
  // -------------------------------------------------------------------------
  console.log("🏨 Seeding Properties & Rooms...");
  let totalRooms = 0;

  for (const p of PROPERTIES) {
    // Upsert Property
    const property = await prisma.property.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        location: p.location,
        description: p.description,
        longDescription: p.longDescription,
        image: p.image,
        facebookPageId: p.facebookPageId || null,
      },
      create: {
        slug: p.slug,
        name: p.name,
        location: p.location,
        description: p.description,
        longDescription: p.longDescription,
        image: p.image,
        facebookPageId: p.facebookPageId || null,
      },
    });

    // Upsert Gallery Images
    if (p.gallery) {
      for (const url of p.gallery) {
        await prisma.propertyImage.upsert({
          where: { id: `${property.id}-${url.slice(-20)}` }, // Pseudo-unique
          update: { url },
          create: { id: `${property.id}-${url.slice(-20)}`, propertyId: property.id, url },
        });
      }
    }

    // Upsert Floor Plan for Property
    if (p.floorPlan) {
      const fp = await prisma.floorPlan.upsert({
        where: { propertyId: property.id },
        update: { imageUrl: p.floorPlan.imageUrl },
        create: { propertyId: property.id, imageUrl: p.floorPlan.imageUrl },
      });
      // Delete old hotspots and recreate
      await prisma.hotspot.deleteMany({ where: { floorPlanId: fp.id } });
      for (const hs of p.floorPlan.hotspots) {
        await prisma.hotspot.create({
          data: {
            floorPlanId: fp.id,
            label: hs.label,
            description: hs.description,
            type: hs.type,
            x: hs.x,
            y: hs.y,
          },
        });
      }
    }

    // Upsert Rooms
    for (const r of p.rooms) {
      await prisma.room.upsert({
        where: { id: `${property.id}-${r.name.toLowerCase().replace(/\s+/g, "-")}` },
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
          id: `${property.id}-${r.name.toLowerCase().replace(/\s+/g, "-")}`,
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
  // 5. EXPERIENCES
  // -------------------------------------------------------------------------
  console.log("🌴 Seeding Local Experiences...");
  for (const e of EXPERIENCES) {
    await prisma.experience.upsert({
      where: { id: e.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30) },
      update: { title: e.title, description: e.description, category: e.category, image: e.image, distance: e.distance },
      create: {
        id: e.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30),
        title: e.title,
        description: e.description,
        category: e.category,
        image: e.image,
        distance: e.distance,
      },
    });
  }
  console.log(`   ✅ ${EXPERIENCES.length} experiences created.\n`);

  // -------------------------------------------------------------------------
  // 6. COUPONS
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
  // 7. UNITS OF MEASURE
  // -------------------------------------------------------------------------
  console.log("📏 Seeding Units of Measure...");
  await seedUnits();
  console.log(`   ✅ Units of measure created.\n`);

  // -------------------------------------------------------------------------
  // 8. STOCK CATEGORIES
  // -------------------------------------------------------------------------
  console.log("📦 Seeding Stock Categories...");
  const STOCK_CATEGORIES = [
    { name: "Ingredient", description: "Food and beverage ingredients", color: "orange", isSystem: true },
    { name: "Linen", description: "Bed sheets, towels, and linens", color: "blue", isSystem: true },
    { name: "Consumable", description: "Cleaning supplies and disposables", color: "green", isSystem: true },
    { name: "Consignment", description: "Supplier-owned items for resale", color: "purple", isSystem: true },
    { name: "Equipment", description: "Tools and equipment", color: "cyan", isSystem: true },
  ];
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
  // DONE
  // -------------------------------------------------------------------------
  console.log("🎉 Database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
