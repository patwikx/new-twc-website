
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const roomTypeName = "Executive Suite";
    const roomType = await prisma.room.findFirst({where: {name: roomTypeName}});
    const propertyId = roomType.propertyId;

    const month = new Date("2026-01-01T00:00:00.000Z");
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const bookings = await prisma.bookingItem.findMany({
        where: {
            room: { propertyId },
            booking: { status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] } }, 
            OR: [
                { checkIn: { lte: endOfMonth }, checkOut: { gte: startOfMonth } }
            ]
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          booking: { select: { shortRef: true } }
        }
    });

    console.log(`Found ${bookings.length} bookings.`);

    const iter = new Date(startOfMonth);
    const daysToSimulate = [5, 6, 8]; 

    while (iter <= endOfMonth) {
        if (daysToSimulate.includes(iter.getDate())) {
           console.log(`\nSimulating Jan ${iter.getDate()}: ${iter.toISOString()}`);
           const dayStart = new Date(iter); dayStart.setHours(0,0,0,0);
           const dayEnd = new Date(iter); dayEnd.setHours(23,59,59,999);

           const activeBookings = bookings.filter(b => {
                const bStart = new Date(b.checkIn);
                const bEnd = new Date(b.checkOut);
                
                if (bStart.getTime() === bEnd.getTime()) {
                   return bStart >= dayStart && bStart < dayEnd;
                }

                return bStart < dayEnd && bEnd > dayStart; 
           });
           
           console.log(`Active Count: ${activeBookings.length}`);
           activeBookings.forEach(ab => {
               console.log(`   * Included: ${ab.booking.shortRef}`);
           });
        }
        iter.setDate(iter.getDate() + 1);
    }

  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
