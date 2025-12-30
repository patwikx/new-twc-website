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
    rooms: [
      {
        id: "ah-std",
        name: "Standard City View",
        price: 3500,
        capacity: 2,
        description: "Elegant room with stunning views of General Santos.",
        amenities: ["Wi-Fi", "Smart TV", "Mini Bar", "City View"],
        image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=2070&auto=format&fit=crop",
      },
      {
        id: "ah-suite",
        name: "Executive Suite",
        price: 8500,
        capacity: 3,
        description: "Spacious suite for the business traveler.",
        amenities: ["Wi-Fi", "Workspace", "Lounge Access", "Bath Tub"],
        image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1974&auto=format&fit=crop",
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

