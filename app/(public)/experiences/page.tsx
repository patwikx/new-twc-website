import { getExperiences } from "@/actions/public/experiences";
import ExperiencesClient from "@/components/experiences/ExperiencesClient";

export default async function ExperiencesPage() {
  const experiences = await getExperiences();

  // Map to the shape expected by the client component
  const experiencesForClient = experiences.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    image: e.image,
    category: e.category,
    distance: e.distance,
  }));

  return <ExperiencesClient experiences={experiencesForClient} />;
}
