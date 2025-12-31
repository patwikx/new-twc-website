import { addDays } from "date-fns";

export const TAX_RATE = 0.12;
export const SERVICE_CHARGE_RATE = 0.10;

export interface Room {
  id: string;
  name: string;
  price: number;
  capacity: number;
  description: string;
  amenities: string[];
  image: string;
  floorPlan?: {
    image: string;
    hotspots: FloorPlanHotspot[];
  };
}

export interface FloorPlanHotspot {
  id: string;
  label: string;
  type: "room" | "pool" | "restaurant" | "spa" | "lobby" | "gym" | "beach" | "bed" | "bath" | "balcony" | "living";
  description: string;
  position: { x: number; y: number }; // Percentage-based position
}

export interface Property {
  id: string;
  name: string;
  location: string;
  slug: string;
  description: string;
  longDescription: string;
  image: string;
  gallery: string[];
  rooms: Room[];
  floorPlan?: {
    image: string;
    hotspots: FloorPlanHotspot[];
  };
  facebookPageId?: string;
}

export interface LocalExperience {
// ... existing interface
}



export interface LocalExperience {
  id: string;
  title: string;
  description: string;
  image: string;
  category: "Nature" | "Culture" | "Food" | "Adventure" | "Wellness";
  distance: string;
}

export const PROPERTIES: Property[] = [
  {
    id: "anchor-hotel",
    name: "Anchor Hotel",
    slug: "anchor-hotel",
    location: "General Santos City, South Cotabato",
    description: "A sanctuary of modern luxury in the heart of GenSan.",
    longDescription:
      "Anchor Hotel represents the pinnacle of urban sophistication in General Santos City. Located in the vibrant city center, it offers immediate access to business districts and cultural landmarks. Our design philosophy merges contemporary aesthetics with timeless comfort.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVjmCl56J2aSpFg1cK04bxM5IZTu7s6YJGtEdr",
    gallery: [
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1974&auto=format&fit=crop"
    ],
    facebookPageId: "100083282241697",
    floorPlan: {
      image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2025&auto=format&fit=crop",
      hotspots: [
        { id: "lobby", label: "Grand Lobby", type: "lobby", description: "Our stunning double-height lobby welcomes you with contemporary Filipino design elements.", position: { x: 50, y: 85 } },
        { id: "restaurant", label: "Cafe Rodrigo", type: "restaurant", description: "Award-winning dining experience featuring farm-to-table cuisine.", position: { x: 25, y: 70 } },
        { id: "gym", label: "Fitness Center", type: "gym", description: "State-of-the-art equipment available 24/7 for our guests.", position: { x: 75, y: 70 } },
        { id: "pool", label: "Infinity Pool", type: "pool", description: "Rooftop infinity pool with panoramic city views.", position: { x: 50, y: 25 } },
        { id: "rooms-std", label: "Standard Rooms", type: "room", description: "Floors 3-5: Elegant rooms with city views.", position: { x: 30, y: 45 } },
        { id: "rooms-suite", label: "Executive Suites", type: "room", description: "Floors 6-8: Spacious suites for the discerning traveler.", position: { x: 70, y: 45 } },
      ],
    },
    rooms: [
      {
        id: "ah-std",
        name: "Standard City View",
        price: 3500,
        capacity: 2,
        description: "Elegant room with stunning views of General Santos.",
        amenities: ["Wi-Fi", "Smart TV", "Mini Bar", "City View"],
        image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=2070&auto=format&fit=crop",
        floorPlan: {
          image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=2158&auto=format&fit=crop", // Placeholder floor plan
          hotspots: [
             { id: "bed", label: "Queen Bed", type: "bed", description: "Plush queen-sized bed with premium linens.", position: { x: 30, y: 50 } },
             { id: "bath", label: "Ensuite Bathroom", type: "bath", description: "Modern bathroom with rain shower.", position: { x: 70, y: 30 } },
             { id: "view", label: "City View Window", type: "balcony", description: "Floor-to-ceiling windows overlooking the city.", position: { x: 50, y: 10 } }
          ]
        }
      },
      {
        id: "ah-suite",
        name: "Executive Suite",
        price: 8500,
        capacity: 3,
        description: "Spacious suite for the business traveler.",
        amenities: ["Wi-Fi", "Workspace", "Lounge Access", "Bath Tub"],
        image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1974&auto=format&fit=crop",
        floorPlan: {
           image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=2158&auto=format&fit=crop",
           hotspots: [
              { id: "bed", label: "King Bed", type: "bed", description: "King-sized bed for ultimate comfort.", position: { x: 30, y: 50 } },
              { id: "living", label: "Living Area", type: "living", description: "Separate living area with sofa and workspace.", position: { x: 70, y: 70 } },
              { id: "bath", label: "Master Bath", type: "bath", description: "Luxurious bathroom with soaking tub.", position: { x: 70, y: 30 } }
           ]
        }
      },
    ],
  },
  {
    id: "dolores-farm",
    name: "Dolores Farm Resort",
    slug: "dolores-farm-resort",
    location: "Polomolok, South Cotabato",
    description: "Experience the rustic charm and tranquility of nature.",
    longDescription:
      "Dolores Farm Resort is your escape to the countryside. Surrounded by lush greenery and organic farms, it provides a unique farm-to-table experience and a peaceful retreat just outside the city.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVCbuJsLAK38AKlBqGNT7RI5pYizjQHwtvsrfV",
    gallery: [
        "https://images.unsplash.com/photo-1587061949409-02df41d5b1d7?q=80&w=2070&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?q=80&w=2074&auto=format&fit=crop"
    ],
    facebookPageId: "123456789012345",
    rooms: [
      {
        id: "df-cabin",
        name: "Rustic Cabin",
        price: 2800,
        capacity: 4,
        description: "Cozy wooden cabin surrounded by nature.",
        amenities: ["Porch", "Fireplace", "Kitchenette"],
        image: "https://images.unsplash.com/photo-1449156493391-d2cfa28e468b?q=80&w=2074&auto=format&fit=crop",
      },
      {
        id: "df-villa",
        name: "Garden Villa",
        price: 6500,
        capacity: 6,
        description: "Large villa perfect for families.",
        amenities: ["Private Garden", "BBQ Area", "Full Kitchen"],
        image: "https://images.unsplash.com/photo-1585549696872-246e7f849004?q=80&w=2070&auto=format&fit=crop",
      },
    ],
  },
  {
    id: "dolores-lake",
    name: "Dolores Lake Resort",
    slug: "dolores-lake-resort",
    location: "Lake Sebu, South Cotabato",
    description: "Serene lakeside living with breathtaking sunsets.",
    longDescription:
      "Perched on the edge of the pristine Lake Sebu, this resort offers water sports, fishing, and relaxation. The perfect spot for water lovers and those seeking a calm, aquatic atmosphere.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVRlnPT0iBg1ydiaq5LNXQVuEso6hCczW2ejlw", // Replaced broken image
    gallery: [
      "https://images.unsplash.com/photo-1499539347895-65471d80b5a3?q=80&w=2074&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop"
    ],
    rooms: [
      {
        id: "dl-view",
        name: "Lake View Room",
        price: 4200,
        capacity: 2,
        description: "Wake up to the sight of the calm lake.",
        amenities: ["Balcony", "Lake View", "King Bed"],
        image: "https://images.unsplash.com/photo-1560662105-57f8ad6ae2d1?q=80&w=2070&auto=format&fit=crop",
      },
    ],
  },
  {
    id: "dolores-tropicana",
    name: "Dolores Tropicana Resort",
    slug: "dolores-tropicana-resort",
    location: "General Santos City, South Cotabato",
    description: "The ultimate tropical paradise with pristine beaches.",
    longDescription:
      "Dolores Tropicana Resort is a sun-soaked paradise. With white sandy beaches, crystal clear waters, and palm trees, it is the ultimate vacation destination for sun seekers.",
    image: "https://4b9moeer4y.ufs.sh/f/pUvyWRtocgCVNT0qvt8SmBCpIXnj3hsr7gFYc6i9oefMHUEv",
    gallery: [
       "https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop",
       "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?q=80&w=1974&auto=format&fit=crop"
    ],
    rooms: [
      {
        id: "dt-beach",
        name: "Beachfront Bungalow",
        price: 9500,
        capacity: 2,
        description: "Steps away from the ocean.",
        amenities: ["Direct Beach Access", "Private Pool", "Outdoor Shower"],
        image: "https://images.unsplash.com/photo-1439130490301-25e322d88054?q=80&w=2089&auto=format&fit=crop",
      },
    ],
  },
];

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

export const COUPONS = [
  { code: "WELCOME10", type: "percent", value: 0.10, description: "10% off your first booking" },
  { code: "SUMMER500", type: "fixed", value: 500, description: "₱500 off for summer bookings" },
];

export const POLICIES = [
  { title: "Check-in / Check-out", description: "Check-in time starts at 2:00 PM and check-out time is until 12:00 PM." },
  { title: "Cancellation Policy", description: "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours will be charged 50% of the first night." },
  { title: "Children & Extra Beds", description: "Children under 12 years stay free of charge when using existing beds. Extra beds are available upon request for a fee." },
  { title: "Smoking Policy", description: "Smoking is strictly prohibited in all indoor areas. Designated smoking areas are provided." },
  { title: "Pets", description: "Pets are not allowed within the hotel premises, with the exception of service animals." },
];

export const LOCAL_EXPERIENCES: LocalExperience[] = [
  {
    id: "seven-falls",
    title: "Seven Falls of Lake Sebu",
    description: "Marvel at the majestic seven waterfalls connected by a thrilling zipline adventure. A must-see natural wonder in the heart of South Cotabato.",
    image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=2070&auto=format&fit=crop",
    category: "Nature",
    distance: "45 min from Dolores Lake Resort",
  },
  {
    id: "tboli-village",
    title: "T'boli Cultural Village",
    description: "Immerse yourself in the rich heritage of the T'boli tribe. Experience traditional weaving, music, and dance performances.",
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=2064&auto=format&fit=crop",
    category: "Culture",
    distance: "30 min from Dolores Lake Resort",
  },
  {
    id: "tuna-capital",
    title: "General Santos Fish Port",
    description: "Witness the bustling activity of the Tuna Capital of the Philippines. Sample the freshest sashimi straight from the ocean.",
    image: "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?q=80&w=2069&auto=format&fit=crop",
    category: "Food",
    distance: "10 min from Anchor Hotel",
  },
  {
    id: "mt-matutum",
    title: "Mount Matutum Trek",
    description: "Conquer the summit of this majestic stratovolcano and be rewarded with breathtaking views of Sarangani Bay and surrounding provinces.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop",
    category: "Adventure",
    distance: "1 hr from Dolores Farm Resort",
  },
  {
    id: "spa-wellness",
    title: "Traditional Hilot Massage",
    description: "Experience the ancient Filipino art of healing. Our partner spas offer authentic Hilot treatments using locally-sourced oils and herbs.",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070&auto=format&fit=crop",
    category: "Wellness",
    distance: "Available at all properties",
  },
  {
    id: "sarangani-bay",
    title: "Sarangani Bay Island Hopping",
    description: "Explore pristine islands, snorkel in crystal-clear waters, and enjoy a beach barbecue under the sun.",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
    category: "Adventure",
    distance: "20 min from Dolores Tropicana Resort",
  },
  {
    id: "pineapple-farm",
    title: "Dole Pineapple Plantation Tour",
    description: "Take a guided tour through one of the world's largest pineapple plantations and taste the sweetest pineapples on earth.",
    image: "https://images.unsplash.com/photo-1490885578174-acda8905c2c6?q=80&w=2069&auto=format&fit=crop",
    category: "Nature",
    distance: "15 min from Dolores Farm Resort",
  },
  {
    id: "gensan-food-trip",
    title: "GenSan Food Crawl",
    description: "A curated culinary journey through General Santos City's best kept secrets – from grilled tuna belly to local delicacies.",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2087&auto=format&fit=crop",
    category: "Food",
    distance: "Various locations",
  },
];
