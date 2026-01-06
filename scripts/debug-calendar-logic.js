
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const roomTypeName = "Executive Suite";
    const roomType = await prisma.room.findFirst({where: {name: roomTypeName}});
    if (!roomType) return;
    const propertyId = roomType.propertyId;

    console.log(`Debug getCalendarData logic for: ${roomTypeName} (${roomType.id}) Property: ${propertyId}`);

    const month = new Date("2026-01-01T00:00:00.000Z");
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Fetch Booking Items
    const bookings = await prisma.bookingItem.findMany({
        where: {
            room: { propertyId },
            booking: { status: { in: ['CONFIRMED', 'PENDING'] } },
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
          },
          roomUnit: { select: { number: true } }
        }
    });

    console.log(`Found ${bookings.length} raw bookings.`);
    bookings.forEach(b => {
        console.log(` - Ref:${b.booking.shortRef} Status:${b.booking.status} Dates:${b.checkIn.toISOString()} to ${b.checkOut.toISOString()}`);
    });

    // Simulate Loop
    let outputCount = 0;
    const iter = new Date(startOfMonth);
    while (iter <= endOfMonth) {
        // Only check Jan 6
        if (iter.getDate() === 6) {
           console.log(`\nSimulating Jan 6: ${iter.toISOString()}`);
           
           const activeBookings = bookings.filter(b => {
                const bStart = new Date(b.checkIn);
                const bEnd = new Date(b.checkOut);
                bStart.setHours(0,0,0,0);
                bEnd.setHours(0,0,0,0);
                const current = new Date(iter);
                current.setHours(0,0,0,0);
                
                const included = current >= bStart && current < bEnd;
                console.log(`   - Checking ${b.booking.shortRef}: Start:${bStart.toISOString()}, End:${bEnd.toISOString()}. Included? ${included}`);
                return included;
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
