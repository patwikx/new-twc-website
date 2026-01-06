
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roomTypeName = "Executive Suite";
  
  // 1. Get Room Type ID
  const roomType = await prisma.room.findFirst({
    where: { name: roomTypeName },
    include: { units: true }
  });

  if (!roomType) {
    console.log(`Room Type "${roomTypeName}" not found.`);
    return;
  }

  console.log(`Room Type: ${roomType.name} (ID: ${roomType.id})`);
  console.log(`Total Units: ${roomType.units.length}`);
  roomType.units.forEach(u => console.log(` - Unit ${u.number}: Status=${u.status}, Active=${u.isActive}`));

  // 2. Check Bookings for Jan 6 - Jan 9 2026
  const checkIn = new Date("2026-01-06T00:00:00.000Z");
  const checkOut = new Date("2026-01-09T00:00:00.000Z");

  console.log(`\nChecking bookings for range: ${checkIn.toISOString()} - ${checkOut.toISOString()}`);

  const bookings = await prisma.bookingItem.findMany({
    where: {
      roomId: roomType.id,
      booking: {
        status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] } 
      },
      AND: [
        { checkIn: { lt: checkOut } },
        { checkOut: { gt: checkIn } }
      ]
    },
    include: { booking: true }
  });

  console.log(`Found ${bookings.length} overlapping bookings:`);
  bookings.forEach(b => {
      console.log(` - Booking ${b.booking.shortRef}: Status=${b.booking.status}, Dates=${b.checkIn.toISOString()} to ${b.checkOut.toISOString()}, CheckIn=${b.booking.checkIn.toISOString()}, CheckOut=${b.booking.checkOut.toISOString()}`);
  });

  // 3. Check specific COMPLETED bookings that might be lingering
  const completedBookings = await prisma.bookingItem.findMany({
      where: {
          roomId: roomType.id,
          booking: { status: 'COMPLETED' },
          AND: [
             { checkIn: { lt: checkOut } },
             { checkOut: { gt: checkIn } }
          ]
      },
      include: { booking: true }
  });
  console.log(`\nFound ${completedBookings.length} overlapping COMPLETED bookings (Should be available):`);
  completedBookings.forEach(b => {
       console.log(` - Booking ${b.booking.shortRef}: CheckOut Date in Item=${b.checkOut.toISOString()}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
