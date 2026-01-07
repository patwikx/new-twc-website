"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, MoreVertical, Clock, DollarSign, Sparkles, Ban, CheckCircle } from "lucide-react";
import { POSTableStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface TableOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: Date;
  customerName?: string | null;
}

interface TableCardProps {
  id: string;
  number: string;
  capacity: number;
  status: POSTableStatus;
  positionX?: number | null;
  positionY?: number | null;
  currentOrder?: TableOrder | null;
  onSelect?: (tableId: string) => void;
  onStatusChange?: (tableId: string, status: POSTableStatus) => void;
  isSelected?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG: Record<POSTableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  AVAILABLE: {
    label: "Available",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  OCCUPIED: {
    label: "Occupied",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  RESERVED: {
    label: "Reserved",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  DIRTY: {
    label: "Dirty",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    color: "text-neutral-400",
    bgColor: "bg-neutral-500/10",
    borderColor: "border-neutral-500/30",
  },
};

export function TableCard({
  id,
  number,
  capacity,
  status,
  currentOrder,
  onSelect,
  onStatusChange,
  isSelected = false,
  compact = false,
}: TableCardProps) {
  const config = STATUS_CONFIG[status];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getOrderDuration = (createdAt: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(id);
    }
  };

  const handleStatusChange = (newStatus: POSTableStatus) => {
    if (onStatusChange) {
      onStatusChange(id, newStatus);
    }
  };

  if (compact) {
    return (
      <Card
        className={cn(
          "p-3 cursor-pointer transition-all hover:scale-105",
          config.bgColor,
          config.borderColor,
          isSelected && "ring-2 ring-orange-500"
        )}
        onClick={handleClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-white">{number}</span>
            <div className="flex items-center gap-1 text-neutral-400">
              <Users className="h-3 w-3" />
              <span className="text-xs">{capacity}</span>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", config.color, config.borderColor)}>
            {config.label}
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:scale-[1.02]",
        config.bgColor,
        config.borderColor,
        isSelected && "ring-2 ring-orange-500"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-2xl text-white">{number}</span>
            <Badge variant="outline" className={cn("text-xs", config.color, config.borderColor)}>
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-neutral-400 mt-1">
            <Users className="h-3.5 w-3.5" />
            <span className="text-sm">{capacity} seats</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-neutral-900 border-white/10">
            {status === "DIRTY" && (
              <DropdownMenuItem onClick={() => handleStatusChange("AVAILABLE")}>
                <Sparkles className="h-4 w-4 mr-2 text-green-400" />
                Mark as Clean
              </DropdownMenuItem>
            )}
            {status === "AVAILABLE" && (
              <>
                <DropdownMenuItem onClick={() => handleStatusChange("RESERVED")}>
                  <Clock className="h-4 w-4 mr-2 text-blue-400" />
                  Reserve Table
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("OUT_OF_SERVICE")}>
                  <Ban className="h-4 w-4 mr-2 text-neutral-400" />
                  Mark Out of Service
                </DropdownMenuItem>
              </>
            )}
            {status === "RESERVED" && (
              <>
                <DropdownMenuItem onClick={() => handleStatusChange("AVAILABLE")}>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Cancel Reservation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("OUT_OF_SERVICE")}>
                  <Ban className="h-4 w-4 mr-2 text-neutral-400" />
                  Mark Out of Service
                </DropdownMenuItem>
              </>
            )}
            {status === "OUT_OF_SERVICE" && (
              <DropdownMenuItem onClick={() => handleStatusChange("AVAILABLE")}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                Mark as Available
              </DropdownMenuItem>
            )}
            {status === "OCCUPIED" && (
                <>
                   {currentOrder && (
                     <DropdownMenuItem disabled className="text-neutral-500">
                       Table has active order
                     </DropdownMenuItem>
                   )}
                   <DropdownMenuSeparator />
                   <DropdownMenuItem onClick={() => handleStatusChange("AVAILABLE")} className="text-red-400 focus:text-red-400">
                     <Ban className="h-4 w-4 mr-2" />
                     Force Available
                   </DropdownMenuItem>
                </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Order Info */}
      {currentOrder && status === "OCCUPIED" && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-neutral-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{getOrderDuration(currentOrder.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-green-400 font-medium">
              <span>{formatCurrency(Number(currentOrder.total))}</span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
             <div className="text-xs text-neutral-500 font-mono">
               #{currentOrder.orderNumber.split('-').pop()}
             </div>
             {currentOrder.customerName && (
                <div className="text-xs font-medium text-orange-400 truncate max-w-[120px]" title={currentOrder.customerName}>
                  {currentOrder.customerName}
                </div>
             )}
          </div>
        </div>
      )}

      {/* Empty state for available tables */}
      {status === "AVAILABLE" && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-neutral-500 text-center">
            Click to start new order
          </p>
        </div>
      )}

      {/* Reserved indicator */}
      {status === "RESERVED" && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-blue-400 text-center">
            Reserved for guest
          </p>
        </div>
      )}

      {/* Dirty indicator */}
      {status === "DIRTY" && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-yellow-400 text-center">
            Needs cleaning
          </p>
        </div>
      )}
    </Card>
  );
}
