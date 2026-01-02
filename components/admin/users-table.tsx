"use client"

import * as React from "react"
// import { UserRole } from "@prisma/client" // REMOVE unused enum
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
import Link from "next/link"
import { UserRoleCell } from "@/components/admin/UserRoleCell"
import { Badge } from "@/components/ui/badge"

import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"

interface Role {
    id: string;
    name: string;
}

interface Department {
    id: string;
    name: string;
}

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  
  // Relations
  userRole: Role | null;
  department: Department | null;
  status: string; // "ACTIVE" | "INACTIVE"
  
  // Legacy or Helper
  createdAt: Date
}

interface UsersTableProps {
  users: User[]
  roles: Role[]
  departments: Department[]
  canEdit: boolean
  canDelete: boolean
}

export function UsersTable({ users, roles, departments, canEdit, canDelete }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [deptFilter, setDeptFilter] = React.useState("ALL");
  
  // Filter users based on search query AND filters
  const filteredUsers = React.useMemo(() => {
    let result = users;

    // 1. Search (Name/Email/EmpID)
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        result = result.filter((user) => 
            (user.name?.toLowerCase().includes(lowerQuery) || "") ||
            (user.email?.toLowerCase().includes(lowerQuery) || "")
        );
    }

    // 2. Role Filter
    if (roleFilter !== "ALL") {
        result = result.filter(u => u.userRole?.id === roleFilter);
    }

    // 3. Dept Filter
    if (deptFilter !== "ALL") {
        result = result.filter(u => u.department?.id === deptFilter);
    }
    
    // 4. Status Filter
    if (statusFilter !== "ALL") {
        result = result.filter(u => u.status === statusFilter);
    }

    return result;
  }, [users, searchQuery, roleFilter, deptFilter, statusFilter])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full max-w-4xl">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-neutral-900 border-white/10"
                />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[130px] bg-neutral-900 border-white/10">
                   <div className="flex items-center gap-2">
                       {/* <span className="text-muted-foreground">Role:</span> */}
                       <SelectValue placeholder="All roles" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All roles</SelectItem>
                    {roles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

             {/* Status Filter */}
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px] bg-neutral-900 border-white/10">
                   <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
            </Select>

            {/* Dept Filter */}
            <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-full sm:w-[130px] bg-neutral-900 border-white/10">
                   <SelectValue placeholder="All depts" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">All depts</SelectItem>
                    {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

             <Button variant="ghost" className="text-muted-foreground" onClick={() => {
                setRoleFilter("ALL");
                setStatusFilter("ALL");
                setDeptFilter("ALL");
                setSearchQuery("");
            }}>
                Reset
             </Button>

        </div>
        <div className="flex items-center gap-2">
           {canEdit && (
            <Button asChild size="sm" className="h-9 gap-1">
                <Link href="/admin/users/new">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Add User
                    </span>
                </Link>
            </Button>
           )}
        </div>
      </div>
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[250px] pl-4">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No users found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-3">
                             <Avatar className="h-9 w-9 border border-white/10">
                                <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                                <AvatarFallback className="bg-neutral-800 text-xs">{(user.name || "U").substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm text-white">{user.name || "Unnamed User"}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="bg-neutral-800/50 text-neutral-300 border-white/5 font-normal">
                             {user.userRole?.name || "No Role"}
                        </Badge>
                    </TableCell>
                     <TableCell>
                        <span className="text-sm text-neutral-400">
                             {user.department?.name || "—"}
                        </span>
                    </TableCell>
                    <TableCell>
                         <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"} className={`
                            text-[10px] font-medium h-5 px-2
                            ${user.status === "ACTIVE" ? "bg-white text-black hover:bg-white/90" : "bg-neutral-800 text-neutral-400"}
                         `}>
                             {user.status || "ACTIVE"}
                        </Badge>
                    </TableCell>
                   
                    <TableCell className="text-right text-sm text-neutral-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                         <div className="flex items-center justify-end gap-1">
                             {canEdit && (
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10">
                                    <Link href={`/admin/users/${user.id}`}>
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="sr-only">Edit</span>
                                    </Link>
                                </Button>
                             )}
                             {canDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-900/10">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                             )}
                        </div>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users.
      </div>
    </div>
  )
}
