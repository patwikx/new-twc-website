"use client";

import * as React from "react";
import { KitchenOrderCard } from "@/components/admin/pos/kitchen-order-card";
import { KitchenOrder } from "@/lib/pos/kitchen";
import { useKitchenSocket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import { ChefHat, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

interface KitchenDisplayProps {
  outletId: string;
  initialOrders: KitchenOrder[];
}

export function KitchenDisplay({
  outletId,
  initialOrders,
}: KitchenDisplayProps) {
  const router = useRouter();
  const { isConnected, onKitchenUpdate } = useKitchenSocket(outletId);
  const prevOrdersRef = useRef<KitchenOrder[]>(initialOrders);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    // Only available in browser
    if (typeof window !== 'undefined') {
        audioRef.current = new Audio("/sounds/new-order.mp3");
    }
  }, []);

  // Play sound
  const playNewOrderSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Audio play failed", e));
    }
  };

  // Listen for real-time updates
  useEffect(() => {
    const unsub = onKitchenUpdate((data) => {
      console.log("[Kitchen] Update received:", data);
      
      // If new order, play sound immediately (optimistic)
      if (data.action === "new_order") {
        playNewOrderSound();
        toast.info(`New Order #${data.data?.orderNumber || ""}`);
      }

      router.refresh();
    });

    return () => {
      unsub();
    };
  }, [onKitchenUpdate, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
         <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Button variant="ghost" size="sm" onClick={playNewOrderSound} className="mr-2">Test Sound</Button>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            {isConnected ? "Live" : "Offline"}
        </div>
      </div>
      
      {!outletId && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChefHat className="h-12 w-12 text-neutral-600 mb-4" />
            <p className="text-neutral-400">Select an outlet to view kitchen orders</p>
        </div>
      )}

      {outletId && initialOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center h-[50vh]">
            <CheckCircle className="h-16 w-16 text-green-500/50 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
            <p className="text-neutral-400">No active orders in the kitchen</p>
        </div>
      )}
      
      {outletId && initialOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {initialOrders.map((order) => (
            <KitchenOrderCard
                key={order.orderId}
                outletId={outletId}
                orderId={order.orderId}
                orderNumber={order.orderNumber}
                tableNumber={order.tableNumber}
                serverName={order.serverName}
                status={order.status}
                items={order.items}
                createdAt={order.createdAt}
                ageMinutes={order.ageMinutes}
                isOverdue={order.isOverdue}
            />
            ))}
        </div>
      )}
    </div>
  );
}
