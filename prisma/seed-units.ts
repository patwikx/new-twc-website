import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed common units of measure
 * 
 * Unit hierarchy:
 * - Mass: kg (base) -> g (1/1000)
 * - Volume: L (base) -> mL (1/1000)
 * - Count: pc (base, no conversions)
 */
export async function seedUnits() {
  console.log("Seeding units of measure...");

  // Create base units first
  const kilogram = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "kg" },
    update: {},
    create: {
      name: "Kilogram",
      abbreviation: "kg",
      conversionFactor: 1,
      baseUnitId: null,
    },
  });

  const liter = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "L" },
    update: {},
    create: {
      name: "Liter",
      abbreviation: "L",
      conversionFactor: 1,
      baseUnitId: null,
    },
  });

  const piece = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "pc" },
    update: {},
    create: {
      name: "Piece",
      abbreviation: "pc",
      conversionFactor: 1,
      baseUnitId: null,
    },
  });

  // Create derived units
  const gram = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "g" },
    update: {
      baseUnitId: kilogram.id,
      conversionFactor: 0.001, // 1g = 0.001kg
    },
    create: {
      name: "Gram",
      abbreviation: "g",
      conversionFactor: 0.001, // 1g = 0.001kg
      baseUnitId: kilogram.id,
    },
  });

  const milliliter = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "mL" },
    update: {
      baseUnitId: liter.id,
      conversionFactor: 0.001, // 1mL = 0.001L
    },
    create: {
      name: "Milliliter",
      abbreviation: "mL",
      conversionFactor: 0.001, // 1mL = 0.001L
      baseUnitId: liter.id,
    },
  });

  // Additional common units
  const milligram = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "mg" },
    update: {
      baseUnitId: kilogram.id,
      conversionFactor: 0.000001, // 1mg = 0.000001kg
    },
    create: {
      name: "Milligram",
      abbreviation: "mg",
      conversionFactor: 0.000001, // 1mg = 0.000001kg
      baseUnitId: kilogram.id,
    },
  });

  const dozen = await prisma.unitOfMeasure.upsert({
    where: { abbreviation: "dz" },
    update: {
      baseUnitId: piece.id,
      conversionFactor: 12, // 1dz = 12pc
    },
    create: {
      name: "Dozen",
      abbreviation: "dz",
      conversionFactor: 12, // 1dz = 12pc
      baseUnitId: piece.id,
    },
  });

  console.log("Units of measure seeded successfully!");
  console.log({
    baseUnits: [kilogram, liter, piece],
    derivedUnits: [gram, milliliter, milligram, dozen],
  });

  return {
    kilogram,
    gram,
    milligram,
    liter,
    milliliter,
    piece,
    dozen,
  };
}

// Run if executed directly
if (require.main === module) {
  seedUnits()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
