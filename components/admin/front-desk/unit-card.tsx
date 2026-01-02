"use client";

import * as React from "react";
import { User, Sparkles, AlertTriangle, AlertCircle } from "lucide-react";

interface UnitCardProps {
  unit: any; // RoomUnit with relations
  onClick: () => void;
}

export function UnitCard({ unit, onClick }: UnitCardProps) {
  const statusColors = {
    CLEAN: "bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20",
    DIRTY: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20",
    OCCUPIED: "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20",
    MAINTENANCE: "bg-neutral-800 border-white/10 text-neutral-400 hover:bg-neutral-700",
    OUT_OF_ORDER: "bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed"
  };

  const currentGuest = unit.bookingItems?.[0]?.booking?.guestLastName;

  return (
    <div 
      onClick={onClick}
      className={`
        relative aspect-square flex flex-col items-center justify-center gap-2 
        border rounded-xl cursor-pointer transition-all duration-200
        ${statusColors[unit.status as keyof typeof statusColors]}
      `}
    >
      <span className="text-2xl font-bold">{unit.number}</span>
      
      {unit.status === 'OCCUPIED' && (
        <div className="flex flex-col items-center">
            <User className="h-4 w-4 mb-1" />
            <span className="text-xs font-medium truncate max-w-[80px] text-center">{currentGuest || "Guest"}</span>
        </div>
      )}

      {unit.status === 'DIRTY' && (
        <div className="flex flex-col items-center">
             <Sparkles className="h-4 w-4 mb-1" />
             <span className="text-[10px] uppercase tracking-wider font-semibold">Dirty</span>
        </div>
      )}

      {unit.status === 'MAINTENANCE' && (
         <AlertTriangle className="h-5 w-5" />
      )}
    </div>
  );
}
