"use client";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/useCartStore";
import { addDays } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface BookRoomButtonProps {
  propertySlug: string;
  propertyName: string;
  propertyImage: string;
  roomId: string;
  roomName: string;
  roomImage: string;
  roomPrice: number;
  capacity: number;
}

export function BookRoomButton({
  propertySlug,
  propertyName,
  propertyImage,
  roomId,
  roomName,
  roomImage,
  roomPrice,
  capacity,
}: BookRoomButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const addToCart = useCartStore((state) => state.addToCart);

  const handleBookNow = () => {
    setIsLoading(true);
    
    // Get dates from URL or default to today/tomorrow
    const checkInParam = searchParams.get("checkIn");
    const checkOutParam = searchParams.get("checkOut");
    
    const checkIn = checkInParam ? new Date(checkInParam) : new Date();
    const checkOut = checkOutParam ? new Date(checkOutParam) : addDays(new Date(), 1);

    addToCart({
      propertySlug,
      propertyName,
      propertyImage,
      roomId,
      roomName,
      roomImage,
      roomPrice, // This is already a number from the server component
      checkIn,
      checkOut,
      guests: 2, // Default to 2, user can adjust in cart
    });

    router.push("/book");
  };

  return (
    <Button 
      onClick={handleBookNow}
      disabled={isLoading}
      className="w-full h-14 rounded-none text-xs uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition-all duration-500"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book Now"}
    </Button>
  );
}
