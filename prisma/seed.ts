import { PrismaClient } from '@prisma/client';
import { PROPERTIES, LOCAL_EXPERIENCES } from '../lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Clean existing data (optional, careful in prod)
  // await prisma.room.deleteMany();
  // await prisma.property.deleteMany();
  // await prisma.experience.deleteMany();

  // 2. Seed Properties & Rooms
  for (const prop of PROPERTIES) {
    console.log(`Upserting property: ${prop.name}`);
    
    // Create or Update Property
    const dbProperty = await prisma.property.upsert({
      where: { slug: prop.slug },
      update: {},
      create: {
        id: prop.id, // Keep ID consistent if possible, else let cuid gen
        slug: prop.slug,
        name: prop.name,
        location: prop.location,
        description: prop.description,
        longDescription: prop.longDescription,
        image: prop.image,
        facebookPageId: prop.facebookPageId,
        
        // Add Floor Plan if exists
        floorPlan: prop.floorPlan ? {
            create: {
                imageUrl: prop.floorPlan.image,
                hotspots: {
                    create: prop.floorPlan.hotspots.map(h => ({
                        label: h.label,
                        description: h.description,
                        type: h.type,
                        x: h.position.x,
                        y: h.position.y
                    }))
                }
            }
        } : undefined
      },
    });

    // Seed Gallery Images (Primitive approach)
    if (prop.gallery) {
        for (const imgUrl of prop.gallery) {
            await prisma.propertyImage.create({
                data: {
                    propertyId: dbProperty.id,
                    url: imgUrl
                }
            })
        }
    }

    // Seed Rooms
    for (const room of prop.rooms) {
      console.log(`  > Upserting room: ${room.name}`);
      await prisma.room.upsert({
        where: { id: room.id }, // Using mock ID as primary key works if no duplicate cuids collide
        update: {},
        create: {
          id: room.id,
          propertyId: dbProperty.id,
          name: room.name,
          description: room.description,
          capacity: room.capacity,
          price: room.price,
          image: room.image,
          amenities: room.amenities,
          
          // Room Floor Plan
           floorPlan: room.floorPlan ? {
            create: {
                imageUrl: room.floorPlan.image,
                hotspots: {
                    create: room.floorPlan.hotspots.map(h => ({
                        label: h.label,
                        description: h.description,
                        type: h.type,
                        x: h.position.x,
                        y: h.position.y
                    }))
                }
            }
        } : undefined
        },
      });
    }
  }

  // 3. Seed Experiences
  for (const exp of LOCAL_EXPERIENCES) {
    console.log(`Upserting experience: ${exp.title}`);
    await prisma.experience.create({
        data: {
            title: exp.title,
            description: exp.description,
            category: exp.category,
            distance: exp.distance,
            image: exp.image,
        }
    });
  }

  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
