import { Button } from "@/components/ui/button";
import { PROPERTIES } from "@/lib/mock-data";
import { ArrowLeft, Check, Star, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking/BookingWidget";

// In a real app, strict typing for params is needed depending on Next.js version
// but for now, we'll cast or assume it works.
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PropertyDetailsPage({ params }: PageProps) {
  const { slug } = await params;
  const property = PROPERTIES.find((p) => p.slug === slug);

  if (!property) {
    notFound();
  }

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
               {property.rooms.map((room) => (
                 <div key={room.id} className="border border-white/5 rounded-none overflow-hidden bg-card/50 hover:bg-card hover:shadow-lg transition-all duration-300 group">
                    <div className="aspect-video bg-neutral-200 relative overflow-hidden">
                      <Image
                        src={room.image || property.image} 
                        alt={room.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    <div className="p-6 space-y-4">
                       <div className="flex justify-between items-start">
                         <h3 className="text-xl font-semibold">{room.name}</h3>
                         <div className="text-right">
                           <span className="block font-bold">₱{room.price.toLocaleString()}</span>
                           <span className="text-xs text-muted-foreground">per night</span>
                         </div>
                       </div>
                       <p className="text-sm text-muted-foreground">{room.description}</p>
                       <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" /> {room.capacity} Guests
                       </div>
                       <div className="flex flex-wrap gap-2 pt-2">
                         {room.amenities.map(amenity => (
                           <span key={amenity} className="text-xs bg-secondary px-2 py-1 rounded-sm">
                             {amenity}
                           </span>
                         ))}
                       </div>
                       <div className="flex flex-col gap-3 mt-6">
                          <Link href={`/properties/${slug}/rooms/${room.id}`} className="w-full">
                            <Button variant="outline" className="w-full h-12 rounded-none tracking-widest text-xs uppercase border-white/20 hover:bg-white hover:text-black transition-all duration-500">View Details</Button>
                          </Link>
                          <Link href={`/book?property=${slug}&room=${room.id}`} className="w-full">
                            <Button className="w-full h-12 rounded-none tracking-widest text-xs uppercase bg-white text-black hover:bg-neutral-200 transition-all duration-500">Book Now</Button>
                          </Link>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>
         
         {/* Booking Section */}
         <div className="py-12 border-t mt-12">
           <div className="text-center mb-12">
             <h2 className="text-3xl font-light mb-4">Plan Your Stay</h2>
             <p className="text-muted-foreground">Check availability at {property.name}</p>
           </div>
           <BookingWidget />
         </div>

      </div>
    </div>
  );
}
