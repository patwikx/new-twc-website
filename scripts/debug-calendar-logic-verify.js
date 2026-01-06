
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

    // Fetch Booking Items
    const bookings = await prisma.bookingItem.findMany({
        where: {
            room: { propertyId },
            booking: { status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] } }, // ADDED CHECKED_IN
            OR: [
                { checkIn: { lte: endOfMonth }, checkOut: { gte: startOfMonth } }
            ]
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          booking: {
             select: { status: true, shortRef: true }
          }
        }
    });

    console.log(`Found ${bookings.length} bookings.`);

    const iter = new Date(startOfMonth);
    const dayToSimulate = 5; // Jan 5 (Where the bookings actually are)

    while (iter <= endOfMonth) {
        if (iter.getDate() === dayToSimulate) {
           console.log(`\nSimulating Jan ${dayToSimulate}: ${iter.toISOString()}`);
           
           const activeBookings = bookings.filter(b => {
                const bStart = new Date(b.checkIn);
                const bEnd = new Date(b.checkOut);
                bStart.setHours(0,0,0,0);
                bEnd.setHours(0,0,0,0);
                const current = new Date(iter);
                current.setHours(0,0,0,0);
                
                // Logic fix
                if (bStart.getTime() === bEnd.getTime()) {
                   return current.getTime() === bStart.getTime();
                }

                return current >= bStart && current < bEnd; 
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
