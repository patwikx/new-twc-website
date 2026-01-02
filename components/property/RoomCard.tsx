"use client";

import { Button } from "@/components/ui/button";
import { toNumber } from "@/lib/types";
import { useCartStore } from "@/store/useCartStore";
import { Users, ShoppingCart, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";

interface RoomCardProps {
  room: {
    id: string;
    name: string;
    description: string;
    price: Prisma.Decimal | number;
    capacity: number;
    image: string;
    amenities: string[];
  };
  property: {
    slug: string;
    name: string;
    image: string;
  };
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
      propertyName: property.name,
      propertyImage: property.image,
      roomId: room.id,
      roomName: room.name,
      roomImage: room.image,
      roomPrice: toNumber(room.price),
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
            <span className="block font-bold">₱{toNumber(room.price).toLocaleString()}</span>
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
