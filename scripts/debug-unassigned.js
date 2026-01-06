
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const blockingStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];
    
    // Check specific bookings identified earlier
    const refs = ['FWY50BR', 'IYXI7HY'];
    
    const bookings = await prisma.booking.findMany({
      where: { shortRef: { in: refs } },
      include: { items: true }
    });

    console.log("SUSPECT_BOOKINGS:");
    bookings.forEach(b => {
        b.items.forEach(i => {
           console.log(`Ref:${b.shortRef} | RoomUnitId:${i.roomUnitId} | Status:${b.status}`);
        });
    });

  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
