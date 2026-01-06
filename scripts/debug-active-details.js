
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const blockingStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];
   
    const roomType = await prisma.room.findFirst({where: {name: 'Executive Suite'}});
    if(!roomType) return console.log("RT Not Found");

    const bookings = await prisma.bookingItem.findMany({
      where: {
        roomId: roomType.id,
        booking: { status: { in: blockingStatuses } },
        AND: [
          { checkIn: { lt: new Date("2026-01-09") } },
          { checkOut: { gt: new Date("2026-01-06") } }
        ]
      },
      include: { booking: true }
    });

    console.log("ACTIVE_BOOKINGS:");
    bookings.forEach(b => {
       console.log(`ID:${b.booking.id} | Ref:${b.booking.shortRef} | Status:${b.booking.status} | Unit:${b.roomUnitId}`);
    });

  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
