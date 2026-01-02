import { db } from "@/lib/db";

/**
 * Get all properties with their rooms for public display
 */
export async function getProperties() {
  return await db.property.findMany({
    include: {
      rooms: {
        orderBy: { price: "asc" },
      },
      images: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Get a single property by slug with all related data
 */
export async function getPropertyBySlug(slug: string) {
  return await db.property.findUnique({
    where: { slug },
    include: {
      rooms: {
        orderBy: { price: "asc" },
      },
      images: true,
      floorPlan: {
        include: {
          hotspots: true,
        },
      },
      amenities: true,
    },
  });
}

/**
 * Get a single room by ID with property info
 */
export async function getRoomById(roomId: string) {
  return await db.room.findUnique({
    where: { id: roomId },
    include: {
      property: true,
      floorPlan: {
        include: {
          hotspots: true,
        },
      },
    },
  });
}

/**
 * Get room by property slug and room ID
 */
export async function getRoomByPropertyAndId(propertySlug: string, roomId: string) {
  const property = await db.property.findUnique({
    where: { slug: propertySlug },
    include: {
      rooms: {
        where: { id: roomId },
        include: {
          floorPlan: {
            include: { hotspots: true },
          },
        },
      },
    },
  });

  if (!property || property.rooms.length === 0) {
    return null;
  }

  return {
    property,
    room: property.rooms[0],
  };
}
