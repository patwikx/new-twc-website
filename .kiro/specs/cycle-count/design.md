# Design: Cycle Count Process

## Overview

This document describes the technical design for the cycle count feature, including database schema, service architecture, and UI components.

## Database Schema

### New Models

```prisma
// Cycle Count Session
model CycleCount {
  id           String           @id @default(uuid())
  countNumber  String           @unique // CC-2026-0001
  warehouseId  String
  warehouse    Warehouse        @relation(fields: [warehouseId], references: [id])
  type         CycleCountType
  status       CycleCountStatus @default(DRAFT)
  blindCount   Boolean          @default(false) // Hide system qty from counters
  
  scheduledAt  DateTime?
  startedAt    DateTime?
  completedAt  DateTime?
  
  createdById  String
  approvedById String?
  notes        String?          @db.Text
  
  // Calculated summary (updated on completion)
  totalItems      Int?
  itemsCounted    Int?
  itemsWithVariance Int?
  totalVarianceCost Decimal? @db.Decimal(12, 2)
  accuracyPercent   Decimal? @db.Decimal(5, 2)

  items CycleCountItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([warehouseId])
  @@index([status])
  @@index([scheduledAt])
}

enum CycleCountType {
  FULL
  ABC_CLASS_A
  ABC_CLASS_B
  ABC_CLASS_C
  RANDOM
  SPOT
}

enum CycleCountStatus {
  DRAFT
  SCHEDULED
  IN_PROGRESS
  PENDING_REVIEW
  COMPLETED
  CANCELLED
}

// Individual item counts
model CycleCountItem {
  id            String     @id @default(uuid())
  cycleCountId  String
  cycleCount    CycleCount @relation(fields: [cycleCountId], references: [id], onDelete: Cascade)
  stockItemId   String
  stockItem     StockItem  @relation(fields: [stockItemId], references: [id])
  batchId       String?
  batch         StockBatch? @relation(fields: [batchId], references: [id])
  
  // Quantities
  systemQuantity   Decimal   @db.Decimal(10, 3) // Snapshot at count start
  countedQuantity  Decimal?  @db.Decimal(10, 3) // Physical count
  
  // Calculated variance
  variance         Decimal?  @db.Decimal(10, 3)
  variancePercent  Decimal?  @db.Decimal(7, 2)
  varianceCost     Decimal?  @db.Decimal(12, 2)
  unitCost         Decimal?  @db.Decimal(10, 4) // Avg cost at count time
  
  // Audit
  countedById      String?
  countedAt        DateTime?
  notes            String?
  
  // Adjustment tracking
  adjustmentMade   Boolean   @default(false)
  adjustmentId     String?   // StockMovement ID

  @@unique([cycleCountId, stockItemId, batchId])
  @@index([cycleCountId])
  @@index([stockItemId])
}
```

### Schema Updates

Add relation to existing models:

```prisma
// In Warehouse model
model Warehouse {
  // ... existing fields
  cycleCounts CycleCount[]
}

// In StockItem model
model StockItem {
  // ... existing fields
  cycleCountItems CycleCountItem[]
}

// In StockBatch model
model StockBatch {
  // ... existing fields
  cycleCountItems CycleCountItem[]
}
```

## Service Architecture

### CycleCount Service (`lib/inventory/cycle-count.ts`)

```typescript
// Types
interface CreateCycleCountInput {
  warehouseId: string;
  type: CycleCountType;
  blindCount?: boolean;
  scheduledAt?: Date;
  notes?: string;
  itemIds?: string[]; // For SPOT type
  samplePercent?: number; // For RANDOM type
  createdById: string;
}

interface RecordCountInput {
  cycleCountItemId: string;
  countedQuantity: number;
  countedById: string;
  notes?: string;
}

// Core Functions
export async function createCycleCount(data: CreateCycleCountInput)
export async function getCycleCountById(id: string)
export async function getCycleCounts(query: CycleCountQuery)
export async function startCycleCount(id: string)
export async function recordCount(data: RecordCountInput)
export async function recordBulkCounts(cycleCountId: string, counts: RecordCountInput[])
export async function submitForReview(id: string)
export async function approveCycleCount(id: string, approvedById: string)
export async function rejectCycleCount(id: string, reason: string)
export async function cancelCycleCount(id: string)

// Reporting Functions
export async function getCycleCountReport(id: string)
export async function getInventoryAccuracy(warehouseId: string, dateRange: DateRange)
export async function getVarianceAnalysis(warehouseId: string, dateRange: DateRange)

// Helper Functions
export async function generateCountNumber(): Promise<string>
export async function populateCountItems(cycleCountId: string, type: CycleCountType)
export async function calculateVariances(cycleCountId: string)
export async function createAdjustments(cycleCountId: string, approvedById: string)
```

## Workflow State Machine

```
DRAFT ──────────────────────────────────────────────────────────────┐
  │                                                                  │
  ├─[schedule]──► SCHEDULED ──[start]──► IN_PROGRESS                │
  │                   │                       │                      │
  └─[start]───────────┴───────────────────────┤                      │
                                              │                      │
                                        [submit]                     │
                                              │                      │
                                              ▼                      │
                                      PENDING_REVIEW                 │
                                         │      │                    │
                              [approve]──┘      └──[reject]          │
                                  │                   │              │
                                  ▼                   │              │
                              COMPLETED               │              │
                                                      │              │
                                              IN_PROGRESS ◄──────────┘
                                                      
                              [cancel] from any state ──► CANCELLED
```

## ABC Classification Logic

For ABC count types, items are classified by total inventory value:

```typescript
async function classifyItemsABC(warehouseId: string) {
  // Get all items with stock levels
  const items = await db.stockLevel.findMany({
    where: { warehouseId },
    include: { stockItem: true },
  });
  
  // Calculate total value per item
  const itemValues = items.map(item => ({
    stockItemId: item.stockItemId,
    totalValue: Number(item.quantity) * Number(item.averageCost),
  }));
  
  // Sort by value descending
  itemValues.sort((a, b) => b.totalValue - a.totalValue);
  
  // Calculate cumulative percentage
  const totalValue = itemValues.reduce((sum, i) => sum + i.totalValue, 0);
  let cumulative = 0;
  
  return itemValues.map(item => {
    cumulative += item.totalValue;
    const cumulativePercent = (cumulative / totalValue) * 100;
    
    let classification: 'A' | 'B' | 'C';
    if (cumulativePercent <= 80) classification = 'A';      // Top 80% of value
    else if (cumulativePercent <= 95) classification = 'B'; // Next 15% of value
    else classification = 'C';                               // Bottom 5% of value
    
    return { ...item, classification };
  });
}
```

## Variance Calculation

```typescript
async function calculateVariances(cycleCountId: string) {
  const items = await db.cycleCountItem.findMany({
    where: { cycleCountId, countedQuantity: { not: null } },
  });
  
  for (const item of items) {
    const variance = Number(item.countedQuantity) - Number(item.systemQuantity);
    const variancePercent = item.systemQuantity !== 0
      ? (variance / Number(item.systemQuantity)) * 100
      : (variance !== 0 ? 100 : 0);
    const varianceCost = variance * Number(item.unitCost);
    
    await db.cycleCountItem.update({
      where: { id: item.id },
      data: { variance, variancePercent, varianceCost },
    });
  }
  
  // Update summary on CycleCount
  await updateCycleCountSummary(cycleCountId);
}
```

## UI Components

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/inventory/cycle-counts` | `CycleCountsPage` | List all cycle counts |
| `/admin/inventory/cycle-counts/new` | `NewCycleCountPage` | Create new count |
| `/admin/inventory/cycle-counts/[id]` | `CycleCountDetailPage` | View/edit/count |
| `/admin/inventory/cycle-counts/[id]/count` | `CountEntryPage` | Mobile-friendly count entry |

### Components

```
components/admin/inventory/
├── cycle-counts-table.tsx       # List with filters
├── cycle-count-form.tsx         # Create/edit form
├── cycle-count-detail.tsx       # Detail view with status
├── count-entry-form.tsx         # Enter physical counts
├── count-entry-row.tsx          # Single item count input
├── variance-review-table.tsx    # Review variances before approval
├── cycle-count-report.tsx       # Printable report
└── inventory-accuracy-chart.tsx # Accuracy trend chart
```

### Count Entry UI

For efficient counting, the count entry interface should:
- Show item name, SKU, location
- Large input field for quantity
- Optional: barcode scanner support
- Quick navigation between items
- Save progress automatically
- Work well on tablets

## Permissions

| Permission | Description |
|------------|-------------|
| `cycle-count:view` | View cycle counts and reports |
| `cycle-count:create` | Create and schedule cycle counts |
| `cycle-count:count` | Enter physical counts |
| `cycle-count:approve` | Approve counts and create adjustments |
| `cycle-count:cancel` | Cancel cycle counts |

## Integration Points

### Stock Movement
- Approved variances call `adjustStock()` from stock-movement service
- Movement reason: `"Cycle Count Adjustment: CC-2026-0001"`
- Reference type: `"CYCLE_COUNT"`, Reference ID: cycle count item ID

### Reporting
- Add cycle count accuracy to inventory reports
- Include variance trends in dashboard

### Sidebar Navigation
- Add under Inventory section:
  - "Cycle Counts" → `/admin/inventory/cycle-counts`
