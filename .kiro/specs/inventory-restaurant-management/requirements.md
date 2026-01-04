# Requirements Document

## Introduction

This feature adds a comprehensive inventory management system for a hotel property that includes:
- Multi-warehouse inventory tracking (Main Stockroom, Kitchen, Housekeeping, etc.)
- Restaurant menu management with recipe/ingredient costing (Cafe Rodrigo)
- Consignment product tracking for retail/minibar items
- Linen and housekeeping supplies inventory
- Inter-warehouse stock transfers and requisitions
- Cost of Goods Sold (COGS) accounting integration

## Glossary

- **Inventory_System**: The core system managing all stock items, quantities, and movements
- **Warehouse**: A physical or logical storage location (e.g., Main Stockroom, Kitchen, Housekeeping)
- **Stock_Item**: Any trackable inventory item (ingredients, linens, consumables, consignment products)
- **Recipe**: A formula defining ingredients and quantities needed to produce a menu item
- **Menu_Item**: A sellable food/beverage item at Cafe Rodrigo
- **Stock_Transfer**: Movement of inventory between warehouses
- **Requisition**: A formal request from one warehouse to another for stock items
- **COGS_Calculator**: The component that computes Cost of Goods Sold based on recipes and stock costs
- **Unit_of_Measure**: Standard measurement units (grams, pieces, liters, etc.)
- **Stock_Movement**: Any transaction that changes inventory quantity (receipt, transfer, consumption, adjustment)
- **Consignment_Product**: Items provided by suppliers where payment occurs only upon sale
- **Par_Level**: Minimum stock quantity that triggers reorder alerts

## Requirements

### Requirement 1: Warehouse Management

**User Story:** As an inventory manager, I want to manage multiple warehouses, so that I can organize stock by department and location.

#### Acceptance Criteria

1. THE Inventory_System SHALL support creating warehouses with name, type, and property association
2. WHEN a warehouse is created, THE Inventory_System SHALL assign it a unique identifier and track its creation timestamp
3. THE Inventory_System SHALL support warehouse types: MAIN_STOCKROOM, KITCHEN, HOUSEKEEPING, BAR, MINIBAR
4. WHEN viewing a warehouse, THE Inventory_System SHALL display current stock levels for all items in that warehouse
5. THE Inventory_System SHALL allow warehouses to be activated or deactivated without deleting historical data

### Requirement 2: Stock Item Catalog

**User Story:** As an inventory manager, I want to maintain a catalog of all stock items, so that I can track different types of inventory consistently.

#### Acceptance Criteria

1. THE Inventory_System SHALL support stock item categories: INGREDIENT, LINEN, CONSUMABLE, CONSIGNMENT, EQUIPMENT
2. WHEN creating a stock item, THE Inventory_System SHALL require name, category, and primary unit of measure
3. THE Inventory_System SHALL support unit conversions (e.g., 1 kg = 1000 grams) for flexible purchasing and usage
4. WHEN a stock item is marked as consignment, THE Inventory_System SHALL track the supplier and consignment terms
5. THE Inventory_System SHALL support setting par levels per warehouse per item
6. WHEN stock falls below par level, THE Inventory_System SHALL generate a low-stock alert

### Requirement 3: Stock Movements and Tracking

**User Story:** As an inventory manager, I want to track all stock movements, so that I can maintain accurate inventory counts and audit trails.

#### Acceptance Criteria

1. THE Inventory_System SHALL record all stock movements with type, quantity, timestamp, and user
2. WHEN stock is received, THE Inventory_System SHALL increase warehouse quantity and record unit cost
3. WHEN stock is transferred between warehouses, THE Inventory_System SHALL decrease source and increase destination quantities atomically
4. WHEN stock is consumed (e.g., recipe production), THE Inventory_System SHALL decrease quantity and link to the consumption reason
5. WHEN stock is adjusted (count correction), THE Inventory_System SHALL record the variance and require a reason
6. THE Inventory_System SHALL calculate running average cost for each stock item using weighted average method

### Requirement 4: Inter-Warehouse Requisitions

**User Story:** As a kitchen manager, I want to request stock from the main stockroom, so that I can replenish kitchen inventory through a controlled process.

#### Acceptance Criteria

1. WHEN a requisition is created, THE Inventory_System SHALL record requesting warehouse, items, quantities, and requester
2. THE Inventory_System SHALL support requisition statuses: PENDING, APPROVED, PARTIALLY_FULFILLED, FULFILLED, REJECTED
3. WHEN a requisition is approved, THE Inventory_System SHALL allow partial or full fulfillment
4. WHEN a requisition is fulfilled, THE Inventory_System SHALL automatically create stock transfer records
5. IF a requisition cannot be fulfilled due to insufficient stock, THEN THE Inventory_System SHALL notify the requester with available quantities

### Requirement 5: Menu Item Management

**User Story:** As a restaurant manager, I want to manage menu items for Cafe Rodrigo, so that I can maintain an accurate menu with pricing.

#### Acceptance Criteria

1. THE Inventory_System SHALL support menu item creation with name, description, category, and selling price
2. WHEN creating a menu item, THE Inventory_System SHALL allow associating it with a recipe
3. THE Inventory_System SHALL support menu categories: APPETIZER, MAIN_COURSE, DESSERT, BEVERAGE, SIDE_DISH
4. WHEN a menu item is marked unavailable, THE Inventory_System SHALL track the reason (out of stock, seasonal, discontinued)
5. THE Inventory_System SHALL calculate menu item availability based on kitchen warehouse ingredient stock

### Requirement 6: Recipe Management

**User Story:** As a chef, I want to define recipes with precise ingredient quantities, so that I can standardize food preparation and track costs.

#### Acceptance Criteria

1. WHEN creating a recipe, THE Inventory_System SHALL require a list of ingredients with quantities and units
2. THE Inventory_System SHALL validate that all recipe ingredients exist in the stock item catalog
3. WHEN a recipe is saved, THE Inventory_System SHALL calculate the total ingredient cost based on current stock costs
4. THE Inventory_System SHALL support recipe yield (number of portions produced)
5. WHEN ingredient costs change, THE Inventory_System SHALL recalculate affected recipe costs
6. THE Inventory_System SHALL support sub-recipes (e.g., sauce recipe used in multiple dishes)

### Requirement 7: Recipe Cost Calculation (COGS)

**User Story:** As a finance manager, I want accurate cost calculations for menu items, so that I can analyze profitability and set appropriate prices.

#### Acceptance Criteria

1. THE COGS_Calculator SHALL compute recipe cost by summing (ingredient quantity × ingredient unit cost) for all ingredients
2. WHEN calculating unit cost, THE COGS_Calculator SHALL use the weighted average cost from stock movements
3. THE COGS_Calculator SHALL calculate cost per portion by dividing total recipe cost by yield
4. THE COGS_Calculator SHALL calculate food cost percentage as (recipe cost / selling price) × 100
5. WHEN a menu item is sold, THE Inventory_System SHALL record the COGS at time of sale for accurate reporting
6. THE COGS_Calculator SHALL support target food cost percentage alerts (e.g., warn if cost exceeds 35%)

### Requirement 8: Linen and Housekeeping Inventory

**User Story:** As a housekeeping manager, I want to track linens and supplies, so that I can ensure adequate stock for room servicing.

#### Acceptance Criteria

1. THE Inventory_System SHALL track linen items with attributes: type, size, condition, and assigned location
2. WHEN linens are issued to rooms, THE Inventory_System SHALL record the assignment and expected return
3. THE Inventory_System SHALL support linen lifecycle statuses: IN_STOCK, IN_USE, IN_LAUNDRY, DAMAGED, RETIRED
4. WHEN linens are returned damaged, THE Inventory_System SHALL record damage type and update condition
5. THE Inventory_System SHALL generate par level reports for housekeeping supplies per property

### Requirement 9: Consignment Product Management

**User Story:** As a retail manager, I want to track consignment products, so that I can manage supplier relationships and sales accurately.

#### Acceptance Criteria

1. WHEN receiving consignment stock, THE Inventory_System SHALL record supplier, quantity, and agreed selling price
2. THE Inventory_System SHALL track consignment items separately from owned inventory
3. WHEN a consignment item is sold, THE Inventory_System SHALL record the sale and calculate supplier payment due
4. THE Inventory_System SHALL generate consignment settlement reports per supplier per period
5. WHEN consignment items are returned to supplier, THE Inventory_System SHALL update quantities and create return records

### Requirement 10: Batch/Lot Tracking and Expiration Management

**User Story:** As an inventory manager, I want to track batches with expiration dates, so that I can ensure food safety and minimize waste from expired products.

#### Acceptance Criteria

1. WHEN receiving stock, THE Inventory_System SHALL allow recording batch/lot number and expiration date
2. THE Inventory_System SHALL track stock quantities per batch within each warehouse
3. WHEN consuming stock, THE Inventory_System SHALL use FEFO (First Expired, First Out) method by default
4. WHEN a batch approaches expiration (configurable days threshold), THE Inventory_System SHALL generate expiration alerts
5. WHEN a batch expires, THE Inventory_System SHALL flag it as expired and exclude from available stock calculations
6. THE Inventory_System SHALL generate expiration reports showing batches expiring within a specified period

### Requirement 11: Waste Tracking

**User Story:** As a kitchen manager, I want to track food waste and spoilage, so that I can identify patterns and reduce losses.

#### Acceptance Criteria

1. THE Inventory_System SHALL support waste recording with type: SPOILAGE, EXPIRED, DAMAGED, OVERPRODUCTION, PREPARATION_WASTE
2. WHEN recording waste, THE Inventory_System SHALL require quantity, waste type, and optionally batch reference
3. WHEN waste is recorded, THE Inventory_System SHALL decrease stock quantity and record the cost of wasted items
4. THE Inventory_System SHALL calculate waste cost using the batch cost or weighted average cost
5. THE Inventory_System SHALL generate waste reports by type, item, warehouse, and time period
6. THE Inventory_System SHALL calculate waste percentage as (waste cost / total consumption cost) × 100

### Requirement 12: Inventory Reporting

**User Story:** As a manager, I want comprehensive inventory reports, so that I can make informed decisions about purchasing and operations.

#### Acceptance Criteria

1. THE Inventory_System SHALL generate stock valuation reports showing quantity and value per warehouse
2. THE Inventory_System SHALL generate stock movement history reports with filtering by date range, item, and warehouse
3. THE Inventory_System SHALL generate COGS reports per menu item and aggregated by category
4. THE Inventory_System SHALL generate low-stock alerts report showing items below par level
5. THE Inventory_System SHALL generate recipe profitability reports showing cost percentage and margin per item
6. THE Inventory_System SHALL generate batch expiration reports showing items expiring within configurable days
7. THE Inventory_System SHALL generate waste analysis reports with trends and cost impact
