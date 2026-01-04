"use client";

import { useState, useTransition } from "react";
import { AccessLevel } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Eye,
  Settings,
  Loader2,
} from "lucide-react";
import { WarehouseAccessDialog } from "./warehouse-access-dialog";
import {
  revokeWarehouseAccess,
  updateWarehouseAccess,
} from "@/lib/inventory/user-warehouse-access";

interface UserAccess {
  id: string;
  userId: string;
  accessLevel: AccessLevel;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  };
}

interface AvailableUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface WarehouseAccessManagerProps {
  warehouseId: string;
  warehouseName: string;
  usersWithAccess: UserAccess[];
  availableUsers: AvailableUser[];
  canManageAccess: boolean;
}

const ACCESS_LEVEL_CONFIG: Record<
  AccessLevel,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  VIEW: {
    label: "View",
    description: "Read-only access to stock levels and movements",
    icon: <Eye className="h-3.5 w-3.5" />,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  MANAGE: {
    label: "Manage",
    description: "Can perform stock receipts, transfers, adjustments",
    icon: <Settings className="h-3.5 w-3.5" />,
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  ADMIN: {
    label: "Admin",
    description: "Full access including user management",
    icon: <Shield className="h-3.5 w-3.5" />,
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
};


export function WarehouseAccessManager({
  warehouseId,
  warehouseName,
  usersWithAccess,
  availableUsers,
  canManageAccess,
}: WarehouseAccessManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccess | null>(null);
  const [userToRevoke, setUserToRevoke] = useState<UserAccess | null>(null);

  const handleUpdateAccess = (userId: string, newLevel: AccessLevel) => {
    startTransition(async () => {
      const result = await updateWarehouseAccess(userId, warehouseId, newLevel);
      if (result.success) {
        toast.success("Access level updated");
        setEditingUser(null);
      } else {
        toast.error(result.error || "Failed to update access");
      }
    });
  };

  const handleRevokeAccess = () => {
    if (!userToRevoke) return;

    startTransition(async () => {
      const result = await revokeWarehouseAccess(
        userToRevoke.userId,
        warehouseId
      );
      if (result.success) {
        toast.success("Access revoked");
        setUserToRevoke(null);
      } else {
        toast.error(result.error || "Failed to revoke access");
      }
    });
  };

  // Filter out users who already have access
  const usersWithoutAccess = availableUsers.filter(
    (user) => !usersWithAccess.some((access) => access.userId === user.id)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <div>
            <h3 className="text-lg font-semibold text-white">User Access</h3>
            <p className="text-sm text-neutral-400">
              Manage who can access this warehouse
            </p>
          </div>
        </div>
        {canManageAccess && (
          <Button
            onClick={() => setGrantDialogOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Grant Access
          </Button>
        )}
      </div>

      {/* Users Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="pl-4">User</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead>Granted</TableHead>
              {canManageAccess && (
                <TableHead className="text-right pr-4">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersWithAccess.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManageAccess ? 4 : 3}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users have access to this warehouse yet.
                </TableCell>
              </TableRow>
            ) : (
              usersWithAccess.map((access) => {
                const levelConfig = ACCESS_LEVEL_CONFIG[access.accessLevel];
                return (
                  <TableRow
                    key={access.id}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-white/10">
                          <AvatarImage
                            src={access.user.image || undefined}
                            alt={access.user.name || "User"}
                          />
                          <AvatarFallback className="bg-neutral-800 text-xs">
                            {(access.user.name || "U")
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-white">
                            {access.user.name || "Unnamed User"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {access.user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${levelConfig.color} gap-1`}
                      >
                        {levelConfig.icon}
                        {levelConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-400">
                      {new Date(access.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManageAccess && (
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-neutral-400 hover:text-white"
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingUser(access)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Change Access Level
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setUserToRevoke(access)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Access Level Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(ACCESS_LEVEL_CONFIG).map(([level, config]) => (
          <div
            key={level}
            className="flex items-start gap-2 p-3 rounded-lg bg-neutral-900/30 border border-white/5"
          >
            <Badge variant="outline" className={`${config.color} gap-1 mt-0.5`}>
              {config.icon}
              {config.label}
            </Badge>
            <span className="text-xs text-neutral-400">{config.description}</span>
          </div>
        ))}
      </div>

      {/* Grant Access Dialog */}
      <WarehouseAccessDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
        warehouseId={warehouseId}
        warehouseName={warehouseName}
        availableUsers={usersWithoutAccess}
        mode="grant"
      />

      {/* Edit Access Dialog */}
      {editingUser && (
        <WarehouseAccessDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          warehouseId={warehouseId}
          warehouseName={warehouseName}
          availableUsers={[]}
          mode="edit"
          currentUser={editingUser}
          onUpdateAccess={handleUpdateAccess}
        />
      )}

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={!!userToRevoke}
        onOpenChange={(open) => !open && setUserToRevoke(null)}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Revoke Access
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Are you sure you want to revoke{" "}
              <span className="text-white font-medium">
                {userToRevoke?.user.name || userToRevoke?.user.email}
              </span>
              &apos;s access to this warehouse? They will no longer be able to
              view or manage inventory in this location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-800 border-white/10 text-white hover:bg-neutral-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAccess}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Access"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
