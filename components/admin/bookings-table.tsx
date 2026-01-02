"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Eye, MoreHorizontal, Download } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"

interface Booking {
  id: string
  shortRef: string
  guestFirstName: string
  guestLastName: string
  guestEmail: string
  totalAmount: number
  status: string // BookingStatus
  paymentStatus: string // PaymentStatus
  createdAt: Date
  items: {
      room: {
          name: string
          propertyId: string
      } | null
  }[]
  property?: {
      name: string
  } | null
}

interface BookingsTableProps {
  bookings: Booking[]
  canManage: boolean
}

export function BookingsTable({ bookings, canManage }: BookingsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [paymentFilter, setPaymentFilter] = React.useState("ALL");

  const filteredBookings = React.useMemo(() => {
    let result = bookings;

    // 1. Search
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        result = result.filter((b) => 
            b.guestFirstName.toLowerCase().includes(lowerQuery) ||
            b.guestLastName.toLowerCase().includes(lowerQuery) ||
            b.guestEmail.toLowerCase().includes(lowerQuery) ||
            b.shortRef.toLowerCase().includes(lowerQuery)
        );
    }

    // 2. Status Filter
    if (statusFilter !== "ALL") {
        result = result.filter(b => b.status === statusFilter);
    }

    // 3. Payment Filter
    if (paymentFilter !== "ALL") {
        result = result.filter(b => b.paymentStatus === paymentFilter);
    }

    return result;
  }, [bookings, searchQuery, statusFilter, paymentFilter])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full max-w-4xl">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search guest or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-neutral-900 border-white/10"
                />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-neutral-900 border-white/10">
                   <div className="flex items-center gap-2">
                       <SelectValue placeholder="Status" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
            </Select>

            {/* Payment Filter */}
             <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-[140px] bg-neutral-900 border-white/10">
                   <div className="flex items-center gap-2">
                       <SelectValue placeholder="Payment" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All Payments</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
            </Select>

             <Button variant="ghost" className="text-muted-foreground" onClick={() => {
                setStatusFilter("ALL");
                setPaymentFilter("ALL");
                setSearchQuery("");
            }}>
                Reset
             </Button>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[120px] pl-4">Ref</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Property / Room</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Date</TableHead>
              {/* <TableHead className="text-right pr-4">Actions</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No bookings found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredBookings.map((booking) => (
                <TableRow key={booking.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="pl-4 font-mono text-xs text-neutral-400">
                        {booking.shortRef}
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm text-white">{booking.guestFirstName} {booking.guestLastName}</span>
                            <span className="text-xs text-muted-foreground">{booking.guestEmail}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                         <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm text-white truncate">{booking.property?.name || "Unknown Property"}</span>
                            <span className="text-xs text-muted-foreground truncate">
                                {booking.items.map(i => i.room?.name).join(", ") || "No Room"}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                         <Badge variant="outline" className={`
                            text-[10px] font-medium border-0
                            ${booking.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400' : 
                              booking.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' : 
                              booking.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-400'}
                         `}>
                             {booking.status}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={`
                            text-[10px] font-medium border-0
                            ${booking.paymentStatus === 'PAID' ? 'bg-green-500/20 text-green-400' : 'bg-neutral-800 text-neutral-400'}
                         `}>
                             {booking.paymentStatus}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                        ₱{Number(booking.totalAmount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs text-neutral-500">
                        {format(new Date(booking.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    {/* Actions could go here */}
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredBookings.length}</strong> of <strong>{bookings.length}</strong> bookings.
      </div>
    </div>
  )
}
