import { Button } from "@/components/ui/button";
import { getPropertyBySlug, getProperties } from "@/actions/public/properties";
import { toNumber } from "@/lib/types";
import { ArrowLeft, Check, Star, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { RoomCard } from "@/components/property/RoomCard";
import { FloorPlanViewer } from "@/components/property/FloorPlanViewer";

// In a real app, strict typing for params is needed depending on Next.js version
// but for now, we'll cast or assume it works.
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PropertyDetailsPage({ params }: PageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  // Fetch all properties for the BookingWidget
  const allProperties = await getProperties();
  const propertiesForWidget = allProperties.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    rooms: p.rooms.map(r => ({
      id: r.id,
      name: r.name,
      image: r.image,
      price: toNumber(r.price),
      capacity: r.capacity,
    })),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[60vh] md:h-[80vh] bg-neutral-900">
         <Image
           src={property.image}
           alt={property.name}
           fill
           priority
           className="object-cover opacity-60"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
         <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-4">
            <h1 className="text-4xl md:text-7xl font-serif font-light tracking-tight mb-4">{property.name}</h1>
            <p className="text-xl md:text-2xl font-light opacity-90 tracking-widest uppercase">{property.location}</p>
         </div>
      </div>

      <div className="container mx-auto px-4 py-12 -mt-20 relative z-10">
         <div className="bg-card/80 backdrop-blur-md shadow-xl border border-white/5 rounded-none p-8 md:p-12 mb-12 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <p className="text-lg md:text-xl leading-relaxed text-muted-foreground font-serif italic">
                {property.longDescription}
              </p>
              <div className="flex justify-center gap-4 pt-4">
                 <Link href="/dining">
                   <Button variant="outline" className="rounded-none px-8 tracking-widest text-xs uppercase border-white/20 hover:bg-white hover:text-black transition-all duration-500">View Dining</Button>
                 </Link>
                 <Link href="#rooms">
                   <Button className="rounded-none px-8 tracking-widest text-xs uppercase bg-white text-black hover:bg-neutral-200 transition-all duration-500">View Rooms</Button>
                 </Link>
              </div>
            </div>
         </div>

         {/* Rooms Section */}
         <div id="rooms" className="py-12">
            <h2 className="text-3xl font-serif mb-8 text-center italic">Accommodations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {property.rooms.map((room) => {
                 // Serialize room data for client component
                 const serializedRoom = {
                   id: room.id,
                   name: room.name,
                   description: room.description,
                   price: toNumber(room.price),
                   capacity: room.capacity,
                   image: room.image,
                   amenities: room.amenities,
                 };
                 const serializedProperty = {
                   slug: property.slug,
                   name: property.name,
                   image: property.image,
                 };
                 return (
                   <RoomCard key={room.id} room={serializedRoom} property={serializedProperty} />
                 );
               })}
            </div>
         </div>

         {/* Interactive Floor Plan Section */}
         {property.floorPlan && (
           <div className="py-12 border-t border-white/10 mt-12">
             <div className="text-center mb-12">
               <span className="text-orange-500 tracking-widest text-xs uppercase">Interactive Map</span>
               <h2 className="text-3xl font-serif mt-2 italic">Explore the Property</h2>
               <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                 Discover our world-class amenities and facilities. Click on the markers to learn more about each area.
               </p>
             </div>
             <FloorPlanViewer 
               image={property.floorPlan.imageUrl} 
               hotspots={property.floorPlan.hotspots}
               propertyName={property.name}
             />
           </div>
         )}
         
         {/* Booking Section */}
         <div className="py-12 border-t border-white/10 mt-12">
           <div className="text-center mb-12">
             <h2 className="text-3xl font-light mb-4">Plan Your Stay</h2>
             <p className="text-muted-foreground">Check availability at {property.name}</p>
           </div>
           <BookingWidget properties={propertiesForWidget} />
         </div>

      </div>
    </div>
  );
}
