"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, UtensilsCrossed } from "lucide-react";
import { acknowledgePickup } from "@/lib/pos/kitchen";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

export interface ReadyItem {
  id: string;
  name: string;
  quantity: number;
  tableNumber: string | null;
  orderNumber: string;
  orderId: string;
}

interface ReadyForPickupDialogProps {
  readyItem: ReadyItem | null;
  onClose: () => void;
  onAcknowledge: (itemId: string) => void;
}

export function ReadyForPickupDialog({
  readyItem,
  onClose,
  onAcknowledge,
}: ReadyForPickupDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    // Only available in browser
    if (typeof window !== 'undefined') {
        audioRef.current = new Audio("/sounds/ready-for-pickup.mp3");
        // Loop audio until acknowledged
        audioRef.current.loop = true; 
    }
    
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };
  }, []);

  // Play sound when dialog opens
  useEffect(() => {
    if (readyItem && audioRef.current) {
        audioRef.current.play().catch((e) => console.log("Audio play failed", e));
    } else if (!readyItem && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  }, [readyItem]);

  const handleAcknowledge = async () => {
    if (!readyItem) return;

    setIsLoading(true);
    try {
      const result = await acknowledgePickup(readyItem.id);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pickup acknowledged");
        onAcknowledge(readyItem.id);
        
        // Stop sound immediately
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
      }
    } catch {
      toast.error("Failed to acknowledge");
    } finally {
      setIsLoading(false);
    }
  };

  if (!readyItem) return null;

  return (
    <Dialog open={!!readyItem} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-neutral-900 border-white/10 sm:max-w-md p-0 overflow-hidden gap-0" onInteractOutside={(e) => e.preventDefault()}>
        <div className="p-6 pb-0 flex flex-col items-center text-center">
          <div className="bg-green-500/10 p-4 rounded-full mb-4 animate-pulse ring-1 ring-green-500/20">
             <Bell className="h-8 w-8 text-green-500" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white mb-1">
            Order Ready!
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-mono text-sm">
             #{readyItem.orderNumber} • Table {readyItem.tableNumber || "N/A"}
          </DialogDescription>
        </div>

        <div className="my-6 border-y border-dashed border-white/10 py-8 flex flex-col items-center justify-center bg-white/[0.02]">
            <span className="text-xl text-neutral-500 font-medium mb-2 uppercase tracking-widest text-[10px]">Quantity</span>
            <span className="text-7xl font-mono font-bold text-green-500 mb-4 tracking-tighter tabular-nums drop-shadow-sm">
              {readyItem.quantity}
            </span>
            <span className="text-2xl font-bold text-white text-center px-8 leading-tight">
              {readyItem.name}
            </span>
        </div>

        <DialogFooter className="p-6 pt-0 sm:justify-center">
            <Button
              onClick={handleAcknowledge}
              disabled={isLoading}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 text-lg"
            >
              {isLoading ? "Acknowledging..." : "Acknowledge Pickup"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
