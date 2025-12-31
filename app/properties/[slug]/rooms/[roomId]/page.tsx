import { Button } from "@/components/ui/button";
import { PROPERTIES } from "@/lib/mock-data";
import { FloorPlanViewer } from "@/components/property/FloorPlanViewer";
import { ArrowLeft, Bed, Check, Users, Wifi, Wind } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

// Define params type correctly for Next.js 15
type Props = {
  params: Promise<{ slug: string; roomId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function RoomDetailsPage({ params, searchParams }: Props) {
  const { slug, roomId } = await params;
  const { checkIn, checkOut } = await searchParams;
  
  const property = PROPERTIES.find((p) => p.slug === slug);
  if (!property) return notFound();

  const room = property.rooms.find((r) => r.id === roomId);
  if (!room) return notFound();

  const bookUrl = `/book?property=${slug}&room=${roomId}${
     checkIn && typeof checkIn === 'string' ? `&checkIn=${checkIn}` : ''
  }${checkOut && typeof checkOut === 'string' ? `&checkOut=${checkOut}` : ''}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Immersive Hero */}
      <div className="relative h-[70vh]">
        <Image
          src={room.image}
          alt={room.name}
          fill
          className="object-cover opacity-70"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-10">
           <div className="container mx-auto">
             <Link href={`/properties/${slug}`} className="inline-flex items-center text-white/60 hover:text-white transition-colors uppercase tracking-widest text-xs mb-6 group">
                <ArrowLeft className="mr-2 h-3 w-3 group-hover:-translate-x-1 transition-transform" /> Back to {property.name}
             </Link>
             <span className="text-orange-500 uppercase tracking-[0.2em] text-sm font-medium mb-4 block">
                {property.name} Collection
             </span>
             <h1 className="text-5xl md:text-7xl font-serif font-light mb-6">
               {room.name}
             </h1>
             <p className="text-2xl font-light text-white/90">
               ₱{room.price.toLocaleString()} <span className="text-sm opacity-60 ml-2">/ night</span>
             </p>
           </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
         {/* Main Content */}
         <div className="lg:col-span-8 space-y-12">
            <div>
               <h2 className="text-3xl font-serif italic mb-6">Experience</h2>
               <p className="text-neutral-400 text-lg leading-relaxed font-light">
                 {room.description} Designed to provide the ultimate relaxation experience in {property.location}. 
                 Every detail has been carefully curated to ensure your stay is improved by the highest standard of luxury and comfort.
               </p>
            </div>

            <div className="border-t border-white/10 pt-12">
               <h2 className="text-3xl font-serif italic mb-8">Amenities</h2>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {room.amenities.map(amenity => (
                    <div key={amenity} className="flex items-center gap-3 text-neutral-300">
                      <div className="h-2 w-2 bg-orange-500 rounded-full" />
                      <span className="font-light">{amenity}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 text-neutral-300">
                     <Wifi className="h-4 w-4 text-orange-500" />
                     <span className="font-light">High-Speed Wi-Fi</span>
                  </div>
                   <div className="flex items-center gap-3 text-neutral-300">
                     <Wind className="h-4 w-4 text-orange-500" />
                     <span className="font-light">Air Conditioning</span>
                  </div>
                  <div className="flex items-center gap-3 text-neutral-300">
                     <Bed className="h-4 w-4 text-orange-500" />
                     <span className="font-light">Premium Bedding</span>
                  </div>
               </div>
            </div>

            {room.floorPlan && (
               <div className="border-t border-white/10 pt-12 mt-12 mb-12">
                   <h2 className="text-3xl font-serif italic mb-8">Room Layout</h2>
                   <FloorPlanViewer 
                       image={room.floorPlan.image}
                       hotspots={room.floorPlan.hotspots}
                       propertyName={room.name}
                   />
               </div>
            )}

            <div className="aspect-video relative rounded-none overflow-hidden mt-8">
               <Image
                 src={property.gallery[0] || property.image}
                 alt="Room View"
                 fill
                 className="object-cover"
               />
            </div>
         </div>

         {/* Sidebar / Book */}
         <div className="lg:col-span-4 relative">
            <div className="sticky top-32 p-8 border border-white/10 bg-white/5 backdrop-blur-sm rounded-none space-y-8">
               <div className="text-center space-y-2">
                 <p className="text-sm uppercase tracking-widest text-neutral-500">Starting from</p>
                 <p className="text-4xl font-serif">₱{room.price.toLocaleString()}</p>
                 <p className="text-xs text-neutral-500">Excluding taxes & fees</p>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between text-sm py-4 border-b border-white/10">
                     <span className="text-neutral-400">Capacity</span>
                     <span>{room.capacity} Guests</span>
                  </div>
                  <div className="flex justify-between text-sm py-4 border-b border-white/10">
                     <span className="text-neutral-400">View</span>
                     <span>{room.name.includes("View") ? "Scenic View" : "Standard View"}</span>
                  </div>
                  <div className="flex justify-between text-sm py-4 border-b border-white/10">
                     <span className="text-neutral-400">Bed Type</span>
                     <span>King / Twin</span>
                  </div>
               </div>

               <Link href={bookUrl}>
                 <Button className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500">
                   Book Now
                 </Button>
               </Link>
            </div>
         </div>
      </div>
    </div>
  );
}
