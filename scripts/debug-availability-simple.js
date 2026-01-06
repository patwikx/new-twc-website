
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const roomType = await prisma.room.findFirst({
      where: { name: "Executive Suite" },
      include: { units: true }
    });

    if (!roomType) {
      console.log('RT_NOT_FOUND');
      return;
    }

    const total = roomType.units.length;
    
    // Statuses that count as "Booked"
    // Assuming fix is applied: CHECKED_IN is overlapping
    const blockingStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];

    const blocked = await prisma.bookingItem.count({
      where: {
        roomId: roomType.id,
        booking: { status: { in: blockingStatuses } },
        AND: [
          { checkIn: { lt: new Date("2026-01-09") } },
          { checkOut: { gt: new Date("2026-01-06") } }
        ]
      }
    });

    const ignored = await prisma.bookingItem.count({
        where: {
            roomId: roomType.id,
            booking: { status: 'COMPLETED' },
            AND: [
                { checkIn: { lt: new Date("2026-01-09") } },
                { checkOut: { gt: new Date("2026-01-06") } }
            ]
        }
    });

    console.log(`TOTAL:${total}`);
    console.log(`BLOCKED:${blocked}`);
    console.log(`IGNORED:${ignored}`);
    console.log(`AVAILABLE:${total - blocked}`);

  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
