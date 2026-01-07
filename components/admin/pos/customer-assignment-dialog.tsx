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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Hotel, 
  Search, 
  Loader2, 
  Check,
  BedDouble,
  Phone
} from "lucide-react";
import { toast } from "sonner";
import { usePOSStore, Customer } from "@/store/usePOSStore";
import { cn } from "@/lib/utils";

interface HotelGuest {
  bookingId: string;
  bookingRef: string;
  guestId: string;
  guestName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
}

interface CustomerAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: string;
  onAssign: (customer: Customer) => Promise<void>;
  // For hotel guest search
  checkedInGuests?: HotelGuest[];
  onSearchGuests?: (query: string) => Promise<HotelGuest[]>;
}

export function CustomerAssignmentDialog({
  open,
  onOpenChange,
  tableNumber,
  onAssign,
  checkedInGuests = [],
  onSearchGuests,
}: CustomerAssignmentDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"walkin" | "guest">("walkin");
  
  // Walk-in form
  const [walkInName, setWalkInName] = React.useState("");
  const [walkInPhone, setWalkInPhone] = React.useState("");
  
  // Hotel guest search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<HotelGuest[]>(checkedInGuests);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedGuest, setSelectedGuest] = React.useState<HotelGuest | null>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setActiveTab("walkin");
      setWalkInName("");
      setWalkInPhone("");
      setSearchQuery("");
      setSearchResults(checkedInGuests);
      setSelectedGuest(null);
    }
  }, [open, checkedInGuests]);

  // Handle guest search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults(checkedInGuests);
      return;
    }

    if (onSearchGuests) {
      setIsSearching(true);
      try {
        const results = await onSearchGuests(query);
        setSearchResults(results);
      } catch {
        toast.error("Failed to search guests");
      } finally {
        setIsSearching(false);
      }
    } else {
      // Client-side filter
      const filtered = checkedInGuests.filter(
        (g) =>
          g.guestName.toLowerCase().includes(query.toLowerCase()) ||
          g.roomNumber.toLowerCase().includes(query.toLowerCase()) ||
          g.bookingRef.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    }
  };

  // Handle walk-in assignment
  const handleWalkInSubmit = async () => {
    if (!walkInName.trim()) {
      toast.error("Please enter customer name");
      return;
    }

    setIsLoading(true);
    try {
      await onAssign({
        type: "WALKIN",
        name: walkInName.trim(),
        phone: walkInPhone.trim() || undefined,
      });
      toast.success(`Customer assigned to Table ${tableNumber}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to assign customer");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle hotel guest assignment
  const handleGuestSubmit = async () => {
    if (!selectedGuest) {
      toast.error("Please select a guest");
      return;
    }

    setIsLoading(true);
    try {
      await onAssign({
        type: "HOTEL_GUEST",
        name: selectedGuest.guestName,
        bookingId: selectedGuest.bookingId,
        bookingRef: selectedGuest.bookingRef,
        roomNumber: selectedGuest.roomNumber,
        guestId: selectedGuest.guestId,
      });
      toast.success(`Guest assigned to Table ${tableNumber}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to assign guest");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Assign Customer to Table {tableNumber}
          </DialogTitle>
          <DialogDescription>
            Enter customer details for walk-ins or select a checked-in hotel guest.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "walkin" | "guest")}>
          <TabsList className="grid grid-cols-2 w-full bg-neutral-800">
            <TabsTrigger value="walkin" className="data-[state=active]:bg-orange-600">
              <User className="h-4 w-4 mr-2" />
              Walk-In
            </TabsTrigger>
            <TabsTrigger value="guest" className="data-[state=active]:bg-orange-600">
              <Hotel className="h-4 w-4 mr-2" />
              Hotel Guest
            </TabsTrigger>
          </TabsList>

          {/* Walk-In Form */}
          <TabsContent value="walkin" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="walkInName">Customer Name *</Label>
              <Input
                id="walkInName"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Enter customer name"
                className="bg-neutral-800 border-white/10"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="walkInPhone">Phone (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  id="walkInPhone"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="pl-10 bg-neutral-800 border-white/10"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleWalkInSubmit}
                disabled={isLoading || !walkInName.trim()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Assign Customer
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Hotel Guest Search */}
          <TabsContent value="guest" className="space-y-4 mt-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name, room, or booking ref..."
                className="pl-10 bg-neutral-800 border-white/10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-neutral-500" />
              )}
            </div>

            {/* Guest List */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500 space-y-3">
                  <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center">
                    <Hotel className="h-8 w-8 opacity-40" />
                  </div>
                  <p>No checked-in guests found</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {searchResults.map((guest) => (
                    <div
                      key={guest.bookingId}
                      className={cn(
                        "group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer",
                        selectedGuest?.bookingId === guest.bookingId
                          ? "bg-orange-500/10 border-orange-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]"
                          : "bg-neutral-800/50 border-white/5 hover:border-orange-500/50 hover:bg-neutral-800"
                      )}
                      onClick={() => setSelectedGuest(guest)}
                    >
                        {/* Helper for initials */}
                        <div className="flex items-center gap-4">
                             <div className={cn(
                                 "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-inner",
                                 selectedGuest?.bookingId === guest.bookingId 
                                    ? "bg-orange-500 text-white shadow-orange-700/50" 
                                    : "bg-neutral-700 text-neutral-400 group-hover:text-white group-hover:bg-neutral-600"
                             )}>
                                 {guest.guestName.charAt(0)}
                             </div>
                             <div>
                                 <h4 className="font-semibold text-white group-hover:text-orange-400 transition-colors text-base">
                                    {guest.guestName}
                                 </h4>
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                        {guest.bookingRef}
                                     </span>
                                 </div>
                             </div>
                        </div>

                        <div className="text-right">
                             <div className={cn(
                                 "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                                 selectedGuest?.bookingId === guest.bookingId
                                    ? "bg-orange-500/20 border-orange-500/30 text-orange-300"
                                    : "bg-neutral-900/50 border-white/5 text-neutral-400 group-hover:border-white/10"
                             )}>
                                 <BedDouble className="h-4 w-4" />
                                 {guest.roomNumber}
                             </div>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGuestSubmit}
                disabled={isLoading || !selectedGuest}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Assign Guest
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
