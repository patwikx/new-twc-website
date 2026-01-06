"use client";

import { Card } from "@/components/ui/card";
import { 
  Users, 
  LogIn, 
  LogOut, 
  BedDouble, 
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DashboardStatsProps {
  stats: {
    arrivals: number;
    inHouse: number;
    departures: number;
    available: number;
  };
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
}

export function DashboardStats({ stats, onFilterChange, activeFilter }: DashboardStatsProps) {
  
  const cards = [
    {
      id: "ARRIVALS",
      label: "Arrivals",
      count: stats.arrivals,
      icon: LogIn,
      description: "Checking in today",
      color: "bg-orange-500",
      textColor: "text-orange-500",
      borderColor: "border-orange-500/20",
      gradient: "from-orange-500/20 to-transparent"
    },
    {
      id: "IN_HOUSE",
      label: "In House",
      count: stats.inHouse,
      icon: Users,
      description: "Currently occupied",
      color: "bg-blue-500",
      textColor: "text-blue-500",
      borderColor: "border-blue-500/20",
      gradient: "from-blue-500/20 to-transparent"
    },
    {
      id: "DEPARTURES",
      label: "Departures",
      count: stats.departures,
      icon: LogOut,
      description: "Checking out today",
      color: "bg-red-500",
      textColor: "text-red-500",
      borderColor: "border-red-500/20",
      gradient: "from-red-500/20 to-transparent"
    },
    {
      id: "AVAILABLE",
      label: "Available",
      count: stats.available,
      icon: BedDouble,
      description: "Units ready",
      color: "bg-emerald-500",
      textColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
      gradient: "from-emerald-500/20 to-transparent"
    }
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-0 p-0 mb-8 w-full border-b border-white/10">
      {cards.map((card, index) => {
        const isActive = activeFilter === card.id;
        
        return (
          <motion.div
            key={card.id}
            whileTap={{ scale: 0.99 }}
            className={cn(
                "cursor-pointer flex-1 min-w-[150px] p-4 relative group first:pl-0",
                index !== cards.length - 1 && "border-b sm:border-b-0 sm:border-r border-white/5"
            )}
            onClick={() => onFilterChange?.(isActive ? null : card.id)}
          >
            <div className={cn(
                "flex flex-col h-full justify-between transition-all",
                isActive ? "opacity-100" : "opacity-60 hover:opacity-100"
            )}>
              <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                     <card.icon className={cn("h-5 w-5", card.textColor)} />
                     <span className={cn("text-xs font-bold uppercase tracking-wider", isActive ? "text-white" : "text-neutral-400 group-hover:text-white transition-colors")}>
                        {card.label}
                     </span>
                 </div>
                 {isActive && (
                    <div className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-white/10", card.textColor)}>
                      Active
                    </div>
                  )}
              </div>
              
              <div>
                <h3 className={cn("text-4xl font-bold tracking-tight mb-1", isActive ? "text-white" : "text-neutral-300 group-hover:text-white")}>{card.count}</h3>
                <p className="text-xs text-neutral-500">{card.description}</p>
              </div>
            </div>
            
            {/* Active Bottom Indicator */}
            {isActive && (
                <motion.div 
                    layoutId="activeIndicator"
                    className={cn("absolute bottom-0 left-0 right-0 h-1", `bg-${card.color.split('-')[1]}-500`)} 
                />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
