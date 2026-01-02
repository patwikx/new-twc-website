import { getProperties } from "@/actions/public/properties";
import { toNumber } from "@/lib/types";
import HomePageClient from "@/components/home/HomePageClient";

export default async function Home() {
  const properties = await getProperties();

  // Map to the shape expected by the client component
  const propertiesForClient = properties.map(p => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    location: p.location,
    description: p.description,
    image: p.image,
    rooms: p.rooms.map(r => ({
      id: r.id,
      name: r.name,
      image: r.image,
      price: toNumber(r.price),
      capacity: r.capacity,
    })),
  }));

  return <HomePageClient properties={propertiesForClient} />;
}

