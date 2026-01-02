import { db } from "@/lib/db";

/**
 * Get all experiences for public display
 */
export async function getExperiences() {
  return await db.experience.findMany({
    orderBy: { title: "asc" },
  });
}

/**
 * Get experiences by category
 */
export async function getExperiencesByCategory(category: string) {
  return await db.experience.findMany({
    where: { category },
    orderBy: { title: "asc" },
  });
}
