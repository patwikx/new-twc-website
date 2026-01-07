export interface MenuItemCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: MenuItemCategory;
  sellingPrice: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  imageUrl?: string | null;
  availableServings?: number | null;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory: string;
  quantity: number;
  unitPrice: number;
  modifiers: string | null;
  notes: string | null;
  status: string;
  menuItemImage?: string | null;
}

// Re-export specific Prisma enums if needed or use them directly in consumers
// But for TableData we need POSTableStatus
import { POSTableStatus, POSOrderStatus } from "@prisma/client";

export interface TableData {
  id: string;
  number: string;
  capacity: number;
  status: POSTableStatus;
  positionX: number | null;
  positionY: number | null;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    subtotal: number;
    taxAmount: number;
    serviceCharge: number;
    discountAmount: number;
    createdAt: Date;
    customerName?: string | null;
    serverName?: string | null;
    items: OrderItem[];
  }[];
}

export interface CurrentOrder {
  id: string;
  orderNumber: string;
  status: POSOrderStatus;
  tableId: string | null;
  tableName: string | null;
  serverName: string | null;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  total: number;
  customerName?: string | null;
}

import { Decimal } from "@prisma/client/runtime/library";

export interface DiscountType {
  id: string;
  name: string;
  description: string | null;
  percentage: Decimal;
  amount?: Decimal; 
  code: string;
  isActive: boolean;
  requiresId: boolean;
  requiresApproval: boolean;
  maxAmount: Decimal | null;
}
