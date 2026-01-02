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
import { Plus, Pencil, Trash2, Search, MapPin } from "lucide-react"
import Link from "next/link"

interface Property {
  id: string
  name: string
  location: string
  image: string | null
  _count: {
    rooms: number
  }
}

interface PropertiesTableProps {
  properties: Property[]
}

export function PropertiesTable({ properties }: PropertiesTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  // Filter properties based on search query
  const filteredProperties = React.useMemo(() => {
    let result = properties
    
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase()
        result = result.filter((property) => 
            property.name.toLowerCase().includes(lowerQuery) ||
            property.location.toLowerCase().includes(lowerQuery)
        )
    }

    return result
  }, [properties, searchQuery])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 w-full max-w-sm">
            {/* Search */}
            <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-neutral-900 border-white/10"
                />
            </div>
             <Button variant="ghost" className="text-muted-foreground" onClick={() => setSearchQuery("")}>
                Reset
             </Button>
        </div>
        <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-9 gap-1 bg-orange-600 hover:bg-orange-700 text-white rounded-none uppercase tracking-widest text-xs">
                <Link href="/admin/properties/new">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Add Property
                    </span>
                </Link>
            </Button>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[300px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">Name</TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Location</TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">Rooms</TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No properties found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredProperties.map((property) => (
                <TableRow key={property.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-3">
                             {property.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={property.image} alt={property.name} className="h-10 w-16 object-cover bg-neutral-800 rounded-sm" />
                             ) : (
                                <div className="h-10 w-16 bg-neutral-800 rounded-sm flex items-center justify-center text-xs text-muted-foreground">
                                    No Img
                                </div>
                             )}
                            <span className="font-medium text-sm text-white">{property.name}</span>
                        </div>
                    </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2 text-neutral-300">
                             <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                             <span className="text-sm">{property.location}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <span className="text-sm text-neutral-400">
                             {property._count.rooms} units
                        </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                         <div className="flex items-center justify-end gap-1">
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/admin/properties/${property.id}`}>
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
          Showing <strong>{filteredProperties.length}</strong> of <strong>{properties.length}</strong> properties.
      </div>
    </div>
  )
}
