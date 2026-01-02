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
import { Plus, Pencil, Trash2, Search, Home } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Property {
  id: string
  name: string
}

interface Room {
  id: string
  name: string
  propertyId: string
  property: Property
  price: number | string // Decimal serialized or number
  capacity: number
  image: string | null
}

interface RoomsTableProps {
  rooms: Room[]
}

export function RoomsTable({ rooms }: RoomsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [propertyFilter, setPropertyFilter] = React.useState("ALL")

  // Extract unique properties for filter
  const properties = React.useMemo(() => {
    const uniqueProps = new Map()
    rooms.forEach(room => {
      if (!uniqueProps.has(room.propertyId)) {
        uniqueProps.set(room.propertyId, room.property)
      }
    })
    return Array.from(uniqueProps.values())
  }, [rooms])

  // Filter rooms based on search query and property filter
  const filteredRooms = React.useMemo(() => {
    let result = rooms

    // 1. Search
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase()
        result = result.filter((room) => 
            room.name.toLowerCase().includes(lowerQuery)
        )
    }

    // 2. Property Filter
    if (propertyFilter !== "ALL") {
        result = result.filter(room => room.propertyId === propertyFilter)
    }

    return result
  }, [rooms, searchQuery, propertyFilter])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 w-full max-w-lg">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-neutral-900 border-white/10"
                />
            </div>

             {/* Property Filter */}
             <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-neutral-900 border-white/10">
                   <div className="flex items-center gap-2">
                       <SelectValue placeholder="All properties" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All properties</SelectItem>
                    {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

             <Button variant="ghost" className="text-muted-foreground hidden sm:flex" onClick={() => {
                 setSearchQuery("")
                 setPropertyFilter("ALL")
             }}>
                Reset
             </Button>
        </div>
        <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs">
                <Link href="/admin/rooms/new">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Add Room
                    </span>
                </Link>
            </Button>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">Room Name</TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Property</TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Price/Night</TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Capacity</TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRooms.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No rooms found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredRooms.map((room) => (
                <TableRow key={room.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-3">
                             {room.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={room.image} alt={room.name} className="h-10 w-16 object-cover bg-neutral-800 rounded-sm" />
                             ) : (
                                <div className="h-10 w-16 bg-neutral-800 rounded-sm flex items-center justify-center text-xs text-muted-foreground">
                                    No Img
                                </div>
                             )}
                            <span className="font-medium text-sm text-white">{room.name}</span>
                        </div>
                    </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2 text-neutral-300">
                             <Home className="h-3.5 w-3.5 text-neutral-500" />
                             <span className="text-sm">{room.property.name}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <span className="text-sm font-medium">
                            ₱{Number(room.price).toLocaleString()}
                        </span>
                    </TableCell>
                    <TableCell>
                        <span className="text-sm text-neutral-400">
                             {room.capacity} Guests
                        </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                         <div className="flex items-center justify-end gap-1">
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/admin/rooms/${room.id}`}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="sr-only">Edit</span>
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                        </div>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredRooms.length}</strong> of <strong>{rooms.length}</strong> rooms.
      </div>
    </div>
  )
}
