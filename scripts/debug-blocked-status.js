
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const roomType = await prisma.room.findFirst({
      where: { name: "Executive Suite" },
    });
    
    if (!roomType) {
       console.log("Room Type not found");
       return;
    }

    const blockingStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];
    
    const bookings = await prisma.bookingItem.findMany({
      where: {
        roomId: roomType.id,
        booking: { status: { in: blockingStatuses } },
        AND: [
          { checkIn: { lt: new Date("2026-01-09") } },
          { checkOut: { gt: new Date("2026-01-06") } }
        ]
      },
      select: {
          id: true,
          booking: {
              select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  shortRef: true
              }
          }
      }
    });

    console.log("BLOCKED_BOOKINGS:");
    bookings.forEach(b => {
        console.log(`[${b.booking.status}] Ref:${b.booking.shortRef} Created:${b.booking.createdAt.toISOString()}`);
    });

  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
