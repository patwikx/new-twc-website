"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation"; // Added
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Info, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createEvent } from "@/actions/admin/front-desk";
import { getRoomTypesWithUnits, getMenuItems } from "@/actions/admin/events";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  dateRange: z.object({
      from: z.date(),
      to: z.date().optional(),
  }),
  status: z.enum(["TENTATIVE", "CONFIRMED"]),
  guestCount: z.coerce.number().optional(),
  roomCount: z.coerce.number().optional(), // Target
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddEventDialogProps {
  propertyId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddEventDialog({ propertyId, trigger, open, onOpenChange }: AddEventDialogProps) {
  const router = useRouter(); // Initialize router
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  
  // Data State
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Selection State
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>("");
  const [checkedUnitIds, setCheckedUnitIds] = useState<Record<string, boolean>>({});
  const [checkedMenuItemIds, setCheckedMenuItemIds] = useState<Record<string, boolean>>({});

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      status: "TENTATIVE",
      guestCount: 0,
      roomCount: 0,
      description: "",
    },
  });

  // Sync open state if controlled
  useEffect(() => {
      if (open !== undefined) setIsOpen(open);
  }, [open]);

  // Sync internal open change to parent
  useEffect(() => {
      if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  const dateRange = form.watch("dateRange");

  // Fetch Menu Items on Open
  useEffect(() => {
      if (isOpen) {
          // Load Menu Items (independent of dates)
          getMenuItems(propertyId).then(setMenuItems);
      }
  }, [isOpen, propertyId]);

  // Fetch Room Types when Dates Change (and dialog is open)
  useEffect(() => {
      if (isOpen && dateRange?.from) {
          setLoadingData(true);
          const start = dateRange.from;
          const end = dateRange.to || dateRange.from;
          
          getRoomTypesWithUnits(propertyId, start, end)
              .then((rts) => {
                  setRoomTypes(rts);
                  // Auto-select first room type if none selected or not in list
                  if (rts.length > 0 && (!selectedRoomTypeId || !rts.find(r => r.id === selectedRoomTypeId))) {
                      setSelectedRoomTypeId(rts[0].id);
                  }
              })
              .finally(() => setLoadingData(false));
      } else if (isOpen) {
          // If open but no dates, maybe clear room types or just do nothing?
          // User said "skip calling... until populated". 
          // We can leave explicit empty or previous state.
          // Optional: setRoomTypes([]);
      }
  }, [isOpen, propertyId, dateRange?.from, dateRange?.to]);

  function onSubmit(values: FormValues) {
    if (!values.dateRange.from) return; 
    // Prepare data
    // Normalize dates to Hotel Time (2 PM Check-in, 12 PM Check-out) to avoid UTC shifts
    const startDate = new Date(values.dateRange.from);
    startDate.setHours(14, 0, 0, 0); // 2:00 PM

    const endDate = new Date(values.dateRange.to || values.dateRange.from);
    endDate.setHours(12, 0, 0, 0); // 12:00 PM

    const blockedUnitIds = Object.keys(checkedUnitIds).filter(id => checkedUnitIds[id]);
    
    // Prepare menu details
    const selectedMenuItemIds = Object.keys(checkedMenuItemIds).filter(id => checkedMenuItemIds[id]);
    const selectedMenuItems = menuItems.filter(item => selectedMenuItemIds.includes(item.id));
    const menuDetails = selectedMenuItems.length > 0 ? JSON.stringify({ items: selectedMenuItems }) : undefined;

    startTransition(async () => {
      try {
        await createEvent({
             // ... params
             propertyId,
            title: values.title,
            startDate,
            endDate,
            status: values.status,
            guestCount: values.guestCount,
            roomCount: values.roomCount,
            menuDetails,
            description: values.description,
            blockedUnitIds
        });
        
        toast.success("Event Created", {
          description: `Event scheduled with ${blockedUnitIds.length} rooms blocked.`,
        });
        setIsOpen(false);
        form.reset();
        setCheckedUnitIds({});
        setCheckedMenuItemIds({});
        router.refresh(); // Refresh calendar data
      } catch (error) {
         // ... error handling
         console.error(error);
        toast.error("Error", {
          description: "Failed to create event. Please try again.",
        });
      }
    });
  }

  // Filter units for current selected room type
  const currentUnits = roomTypes.find(rt => rt.id === selectedRoomTypeId)?.units || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[85vh] h-auto flex flex-col p-0 bg-neutral-900 border-white/10 text-white">
        <DialogHeader className="px-6 py-4 border-b border-white/10 shrink-0">
          <DialogTitle>Create Event / Function</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Schedule a new event, manage room blocks, and catering.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 w-full justify-start mb-4">
                        <TabsTrigger value="details">Event Details</TabsTrigger>
                        <TabsTrigger value="rooms">Room Blocking</TabsTrigger>
                        <TabsTrigger value="catering">Catering & Menu</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
                                <FormLabel>Event Title</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Wedding Reception" {...field} className="bg-white/5 border-white/10 focus:ring-indigo-500" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                            <FormField
                            control={form.control}
                            name="dateRange"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
                                <FormLabel>Event Dates</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 hover:text-white",
                                            !field.value?.from && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value?.from ? (
                                            field.value.to ? (
                                            <>
                                                {format(field.value.from, "LLL dd, y")} -{" "}
                                                {format(field.value.to, "LLL dd, y")}
                                            </>
                                            ) : (
                                            format(field.value.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        numberOfMonths={2}
                                        initialFocus
                                        className="bg-neutral-900 text-white"
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                    <SelectItem value="TENTATIVE">Tentative</SelectItem>
                                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                            <FormField
                            control={form.control}
                            name="roomCount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Target Rooms</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} value={(field.value as number) || ""} className="bg-white/5 border-white/10" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                            control={form.control}
                            name="guestCount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Est. Guests</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} value={(field.value as number) || ""} className="bg-white/5 border-white/10" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        
                        <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Internal Notes</FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder="Additional notes..." 
                                    className="resize-none bg-white/5 border-white/10 min-h-[100px]" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </TabsContent>

                    <TabsContent value="rooms" className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Select value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId}>
                                <SelectTrigger className="w-[300px] bg-white/5 border-white/10">
                                    <SelectValue placeholder="Select Room Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-white/10 text-white">
                                    {roomTypes.map(rt => (
                                        <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="text-sm text-muted-foreground">
                                {Object.values(checkedUnitIds).filter(Boolean).length} units selected
                            </div>
                        </div>

                        <div className="border border-white/10 rounded-md overflow-hidden bg-white/5">
                            <Table>
                                <TableHeader className="bg-white/5">
                                    <TableRow className="border-white/10 hover:bg-transparent">
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Unit Name</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentUnits.length === 0 ? (
                                         <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                {loadingData ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "No units found for this room type"}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentUnits.map((unit: any) => (
                                            <TableRow 
                                                key={unit.id} 
                                                className="border-white/10 hover:bg-white/5 cursor-pointer"
                                                onClick={() => {
                                                    // Toggle check if available
                                                    if (unit.isAvailable) {
                                                        setCheckedUnitIds(prev => ({
                                                            ...prev,
                                                            [unit.id]: !prev[unit.id]
                                                        }));
                                                    }
                                                }}
                                            >
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox 
                                                            checked={checkedUnitIds[unit.id] || false}
                                                            disabled={!unit.isAvailable}
                                                            onCheckedChange={(checked) => {
                                                                setCheckedUnitIds(prev => ({
                                                                    ...prev,
                                                                    [unit.id]: !!checked
                                                                }));
                                                            }}
                                                        />
                                                    </TableCell>
                                                <TableCell className="font-medium">{unit.name}</TableCell>
                                                <TableCell>
                                                    {unit.isAvailable ? (
                                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Available</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Blocked</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="catering" className="space-y-4">
                         <div className="border border-white/10 rounded-md overflow-hidden bg-white/5">
                             <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Item Name</TableHead>
                                            <TableHead>Category</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                         {loadingData ? (
                                             <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                         ) : menuItems.length === 0 ? (
                                              <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    No menu items available
                                                </TableCell>
                                            </TableRow>
                                         ) : (
                                             menuItems.map((item: any) => (
                                                <TableRow 
                                                    key={item.id} 
                                                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                                                    onClick={() => {
                                                        setCheckedMenuItemIds(prev => ({
                                                            ...prev,
                                                            [item.id]: !prev[item.id]
                                                        }));
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Checkbox 
                                                            checked={checkedMenuItemIds[item.id] || false}
                                                            onCheckedChange={(checked) => {
                                                                setCheckedMenuItemIds(prev => ({
                                                                    ...prev,
                                                                    [item.id]: !!checked
                                                                }));
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="bg-white/10 text-neutral-300">{item.category}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                             ))
                                         )}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            
            <DialogFooter className="px-6 py-4 border-t border-white/10 bg-neutral-900">
               <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="hover:bg-white/10">Cancel</Button>
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
