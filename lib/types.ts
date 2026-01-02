import { Prisma } from "@prisma/client";

// Re-export config constants (these are not in DB)
export const TAX_RATE = 0.12;
export const SERVICE_CHARGE_RATE = 0.10;

export const POLICIES = [
  { title: "Check-in / Check-out", description: "Check-in time starts at 2:00 PM and check-out time is until 12:00 PM." },
  { title: "Cancellation Policy", description: "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours will be charged 50% of the first night." },
  { title: "Children & Extra Beds", description: "Children under 12 years stay free of charge when using existing beds. Extra beds are available upon request for a fee." },
  { title: "Smoking Policy", description: "Smoking is strictly prohibited in all indoor areas. Designated smoking areas are provided." },
  { title: "Pets", description: "Pets are not allowed within the hotel premises, with the exception of service animals." },
];

// Types for DB-backed entities
export type PropertyWithRooms = Prisma.PropertyGetPayload<{
  include: {
    rooms: true;
    images: true;
    floorPlan: {
      include: { hotspots: true };
    };
    amenities: true;
  };
}>;

export type RoomWithProperty = Prisma.RoomGetPayload<{
  include: {
    property: true;
    floorPlan: {
      include: { hotspots: true };
    };
  };
}>;

export type HotspotType = "room" | "pool" | "restaurant" | "spa" | "lobby" | "gym" | "beach" | "bed" | "bath" | "balcony" | "living";

// Adapter interface for FloorPlanViewer component
export interface FloorPlanHotspotDisplay {
  id: string;
  label: string;
  type: HotspotType;
  description: string | null;
  position: { x: number; y: number };
}

// Helper to convert DB hotspots to display format
export function toDisplayHotspots(hotspots: { id: string; label: string; type: string; description: string | null; x: number; y: number }[]): FloorPlanHotspotDisplay[] {
  return hotspots.map(h => ({
    id: h.id,
    label: h.label,
    type: h.type as HotspotType,
    description: h.description,
    position: { x: h.x, y: h.y },
  }));
}

// Helper to convert Decimal price to number
export function toNumber(decimal: Prisma.Decimal | number): number {
  if (typeof decimal === 'number') return decimal;
  return Number(decimal);
}
