
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const roomTypeName = "Executive Suite";
    // 1. Get Room Type
    const roomType = await prisma.room.findFirst({
      where: { name: roomTypeName },
      include: { units: true }
    });

    if (!roomType) {
      console.log(`Room Type "${roomTypeName}" NOT FOUND.`);
      return;
    }

    const totalUnits = roomType.units.length;
    console.log(`[DEBUG] Room: ${roomType.name}, Total Units: ${totalUnits}`);

    // Count Active Units
    const activeUnits = roomType.units.filter(u => u.isActive).length;
    console.log(`[DEBUG] Active Units (isActive=true): ${activeUnits}`);

    // 2. Count Active Bookings (collision)
    // Jan 6 - Jan 9 2026
    const checkIn = new Date("2026-01-06T00:00:00.000Z");
    const checkOut = new Date("2026-01-09T00:00:00.000Z");
    
    // Statuses that count as "Booked"
    const blockingStatuses = ['CONFIRMED', 'PENDING', 'CHECKED_IN'];

    const activeBookingsCount = await prisma.bookingItem.count({
      where: {
        roomId: roomType.id,
        booking: { status: { in: blockingStatuses } },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } }
        ]
      }
    });

    console.log(`[DEBUG] Blocking Bookings (CONFIRMED/PENDING/CHECKED_IN): ${activeBookingsCount}`);
    console.log(`[DEBUG] Calculated Availability: ${activeUnits} - ${activeBookingsCount} = ${activeUnits - activeBookingsCount}`);

    // 3. Count Completed Bookings (ignored)
    const completedBookingsCount = await prisma.bookingItem.count({
        where: {
            roomId: roomType.id,
            booking: { status: 'COMPLETED' },
            AND: [
                { checkIn: { lt: checkOut } },
                { checkOut: { gt: checkIn } }
            ]
        }
    });
    console.log(`[DEBUG] Ignored Completed Bookings: ${completedBookingsCount}`);
    
    // 4. List specific units and their matching bookings
    // This helps identify "Ghost" bookings
    const allBookings = await prisma.bookingItem.findMany({
        where: {
            roomId: roomType.id,
            booking: { status: { in: [...blockingStatuses, 'COMPLETED'] } },
            AND: [
                { checkIn: { lt: checkOut } },
                { checkOut: { gt: checkIn } }
            ]
        },
        include: { booking: true }
    });

    console.log("\n[DEBUG] Detailed Overlap List:");
    allBookings.forEach(b => {
        console.log(` - Ref: ${b.booking.shortRef} | Status: ${b.booking.status} | Dates: ${b.checkIn.toISOString().substring(0,10)} to ${b.checkOut.toISOString().substring(0,10)}`);
    });

  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
