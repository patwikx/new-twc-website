
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find problem bookings by Ref
    // Refs: FMY50BR6, IYXI7HYT
    const refs = ['FMY50BR6', 'IYXI7HYT'];
    
    const bookings = await prisma.booking.findMany({
      where: { shortRef: { in: refs } },
      include: { items: true }
    });

    console.log(`Found ${bookings.length} bookings.`);
    bookings.forEach(b => {
        console.log(`\nBooking Ref: ${b.shortRef} Status: ${b.status}`);
        b.items.forEach(i => {
           console.log(`  Item ID: ${i.id}`);
           console.log(`  CheckIn:  ${i.checkIn.toISOString()} (${i.checkIn.getTime()})`);
           console.log(`  CheckOut: ${i.checkOut.toISOString()} (${i.checkOut.getTime()})`);
           
           const start = new Date(i.checkIn); start.setHours(0,0,0,0);
           const end = new Date(i.checkOut); end.setHours(0,0,0,0);
           console.log(`  Start (Midnight): ${start.toISOString()} (${start.getTime()})`);
           console.log(`  End   (Midnight): ${end.toISOString()} (${end.getTime()})`);
           console.log(`  Same Day? ${start.getTime() === end.getTime()}`);
        });
    });

  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
