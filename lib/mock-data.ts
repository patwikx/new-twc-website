/**
 * mock-data.ts - Static Configuration Data
 * 
 * NOTE: Properties, Rooms, Experiences, and Coupons have been migrated to the database.
 * This file now only contains static configuration that doesn't need database storage.
 */

// Tax and service charge rates
export const TAX_RATE = 0.12;
export const SERVICE_CHARGE_RATE = 0.10;

// Static dining menu (could be moved to DB later if needed)
export const DINING = {
  name: "Cafe Rodrigo",
  description:
    "A culinary journey featuring local GenSan flavors and international favorites.",
  menuHighlights: [
    {
      name: "Tuna Special",
      price: 850,
      description: "Fresh GenSan Tuna grilled to perfection.",
    },
    {
      name: "Lake Catch of the Day",
      price: 650,
      description: "Freshly caught grilled tilapia.",
    },
    {
      name: "Farm Fresh Salad",
      price: 450,
      description: "Organic vegetables from Dolores Farm.",
    },
  ],
};

// Static events configuration (could be moved to DB later if needed)
export const EVENTS = [
  {
    id: "biz-conf",
    title: "Business Conferences",
    description: "State-of-the-art facilities for your corporate needs.",
    capacity: "Up to 150 guests",
  },
  {
    id: "weddings",
    title: "Dream Weddings",
    description: "Magical venues for your special day.",
    capacity: "Up to 100 guests",
  },
];

// Booking policies (static content)
export const POLICIES = [
  { title: "Check-in / Check-out", description: "Check-in time starts at 2:00 PM and check-out time is until 12:00 PM." },
  { title: "Cancellation Policy", description: "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours will be charged 50% of the first night." },
  { title: "Children & Extra Beds", description: "Children under 12 years stay free of charge when using existing beds. Extra beds are available upon request for a fee." },
  { title: "Smoking Policy", description: "Smoking is strictly prohibited in all indoor areas. Designated smoking areas are provided." },
  { title: "Pets", description: "Pets are not allowed within the hotel premises, with the exception of service animals." },
];

