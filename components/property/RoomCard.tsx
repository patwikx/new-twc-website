"use client";

import { Button } from "@/components/ui/button";
import { Room, Property } from "@/lib/mock-data";
import { useCartStore } from "@/store/useCartStore";
import { Users, ShoppingCart, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";


interface RoomCardProps {
  room: Room;
  property: Property;
}

export function RoomCard({ room, property }: RoomCardProps) {
  const { addToCart, setDrawerOpen } = useCartStore();
  
  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectRoom = () => {
    addToCart({
      propertySlug: property.slug,
      roomId: room.id,
      checkIn: new Date(),
      checkOut: addDays(new Date(), 1),
      guests: 2,
    });
    setDrawerOpen(true);
  };

  return (
    <div className="border border-white/5 rounded-none overflow-hidden bg-card/50 hover:bg-card hover:shadow-lg transition-all duration-300 group">
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
          {room.amenities.map((amenity) => (
            <span key={amenity} className="text-xs bg-secondary px-2 py-1 rounded-sm">
              {amenity}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3 mt-6">
          <Link href={`/properties/${property.slug}/rooms/${room.id}`} className="w-full">
            <Button
              variant="outline"
              className="w-full h-12 rounded-none tracking-widest text-xs uppercase border-white/20 hover:bg-white hover:text-black transition-all duration-500"
            >
              View Details
            </Button>
          </Link>
          <Button
            onClick={handleSelectRoom}
            className="w-full h-12 rounded-none tracking-widest text-xs uppercase transition-all duration-500 bg-white text-black hover:bg-neutral-200"
          >
            Select Room
          </Button>
        </div>
      </div>
    </div>
  );
}
