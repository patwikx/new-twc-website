"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { 
  Building2, 
  UtensilsCrossed, 
  Dumbbell, 
  Waves, 
  DoorOpen, 
  Sparkles,
  Palmtree,
  X,
  BedDouble,
  Bath,
  Armchair,
  Maximize
} from "lucide-react";

type HotspotType = "room" | "pool" | "restaurant" | "spa" | "lobby" | "gym" | "beach" | "bed" | "bath" | "balcony" | "living";

interface Hotspot {
  id: string;
  label: string;
  type: string;
  description: string | null;
  x: number;
  y: number;
}

interface FloorPlanViewerProps {
  image: string;
  hotspots: Hotspot[];
  propertyName: string;
}

const iconMap: Record<HotspotType, React.ReactNode> = {
  lobby: <Building2 className="h-4 w-4" />,
  restaurant: <UtensilsCrossed className="h-4 w-4" />,
  gym: <Dumbbell className="h-4 w-4" />,
  pool: <Waves className="h-4 w-4" />,
  room: <DoorOpen className="h-4 w-4" />,
  spa: <Sparkles className="h-4 w-4" />,
  beach: <Palmtree className="h-4 w-4" />,
  bed: <BedDouble className="h-4 w-4" />,
  bath: <Bath className="h-4 w-4" />,
  balcony: <Maximize className="h-4 w-4" />,
  living: <Armchair className="h-4 w-4" />,
};

const colorMap: Record<HotspotType, string> = {
  lobby: "bg-amber-500",
  restaurant: "bg-rose-500",
  gym: "bg-blue-500",
  pool: "bg-cyan-500",
  room: "bg-violet-500",
  spa: "bg-pink-500",
  beach: "bg-teal-500",
  bed: "bg-indigo-500",
  bath: "bg-sky-500",
  balcony: "bg-emerald-500",
  living: "bg-orange-500",
};

export function FloorPlanViewer({ image, hotspots, propertyName }: FloorPlanViewerProps) {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <div className="relative">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 justify-center">
        {Array.from(new Set(hotspots.map(h => h.type))).map((type) => (
          <div key={type} className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`w-3 h-3 rounded-full ${colorMap[type as HotspotType] || 'bg-neutral-500'}`} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Floor Plan Container */}
      <div 
        className={`relative aspect-[16/9] bg-neutral-900 border border-white/10 overflow-hidden cursor-zoom-in transition-all duration-500 ${
          isZoomed ? "scale-110 cursor-zoom-out" : ""
        }`}
        onClick={() => setIsZoomed(!isZoomed)}
      >
        <Image
          src={image}
          alt={`${propertyName} Floor Plan`}
          fill
          className="object-cover opacity-70"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Hotspots */}
        {hotspots.map((hotspot) => (
          <motion.button
            key={hotspot.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className={`absolute z-10 w-8 h-8 rounded-full ${colorMap[hotspot.type as HotspotType] || 'bg-neutral-500'} flex items-center justify-center text-white shadow-lg hover:scale-125 transition-transform cursor-pointer`}
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveHotspot(activeHotspot?.id === hotspot.id ? null : hotspot);
            }}
            aria-label={hotspot.label}
          >
            {iconMap[hotspot.type as HotspotType] || null}
            
            {/* Pulse Animation */}
            <span className={`absolute inset-0 rounded-full ${colorMap[hotspot.type as HotspotType] || 'bg-neutral-500'} animate-ping opacity-50`} />
          </motion.button>
        ))}

        {/* Active Hotspot Info Panel */}
        <AnimatePresence>
          {activeHotspot && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-neutral-950/95 backdrop-blur-sm border border-white/10 p-6 z-20"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHotspot(null);
                }}
                className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-8 h-8 rounded-full ${colorMap[activeHotspot.type as HotspotType] || 'bg-neutral-500'} flex items-center justify-center text-white`}>
                  {iconMap[activeHotspot.type as HotspotType] || null}
                </span>
                <div>
                  <h4 className="font-medium text-white">{activeHotspot.label}</h4>
                  <p className="text-xs text-neutral-500 capitalize">{activeHotspot.type}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {activeHotspot.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <p className="text-center text-xs text-neutral-500 mt-4">
        Click on the markers to explore different areas • Click the image to zoom
      </p>
    </div>
  );
}
