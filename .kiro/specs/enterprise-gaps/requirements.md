# Requirements Document

## Introduction

This document defines the requirements for implementing enterprise-level features to transform the current hotel management system into a fully functioning enterprise hotel/restaurant management application. All features are property-aware, meaning they operate within the context of the currently selected property from the Property Switcher.

## Glossary

- **Property**: A hotel or resort business unit managed within the system
- **Property_Switcher**: UI component that allows users to select which property context they are operating in
- **Property_Scope**: The current property context (specific property ID or "ALL" for super admins)
- **POS_System**: Point of Sale system for restaurant, bar, and room service operations
- **Sales_Outlet**: A revenue-generating location (Restaurant, Bar, Room Service, Pool Bar)
- **Order**: A customer transaction containing menu items at a sales outlet
- **KDS**: Kitchen Display System for order routing and preparation tracking
- **User_Warehouse_Access**: Permission system controlling which warehouses a user can access
- **Access_Level**: Permission tier (VIEW, MANAGE, ADMIN) for warehouse operations
- **Purchase_Order**: Document requesting stock items from a supplier
- **PO_Status**: Workflow state of a purchase order (DRAFT → APPROVED → RECEIVED)
- **Audit_Log**: Record of system changes with user, timestamp, and before/after values
- **Shift**: A cashier's work period with opening/closing cash reconciliation
- **Guest_Folio**: A guest's running account of charges during their stay

## Requirements

### Requirement 1: Property-Aware Data Filtering

**User Story:** As a property manager, I want all data to be filtered by my current property context, so that I only see information relevant to my property.

#### Acceptance Criteria

1. WHEN a user selects a property from the Property_Switcher, THE System SHALL filter all subsequent data queries to that property's scope
2. WHILE a user has a specific property selected, THE System SHALL only display warehouses, stock items, orders, and reports belonging to that property
3. WHEN a super admin selects "All Properties", THE System SHALL display aggregated data across all properties
4. IF a user attempts to access data outside their property scope, THEN THE System SHALL deny access and display an authorization error

### Requirement 2: User-Warehouse Access Control

**User Story:** As a system administrator, I want to control which warehouses each user can access, so that staff only see and manage inventory they are responsible for.

#### Acceptance Criteria

1. THE System SHALL maintain a UserWarehouseAccess record linking users to warehouses with an access level
2. WHEN a user with VIEW access queries a warehouse, THE System SHALL allow read-only access to stock levels and movements
3. WHEN a user with MANAGE access operates on a warehouse, THE System SHALL allow stock receipts, transfers, adjustments, and requisitions
4. WHEN a user with ADMIN access manages a warehouse, THE System SHALL allow all operations including user access management
5. WHEN a user without warehouse access attempts to view a warehouse, THE System SHALL hide that warehouse from all lists and queries
6. WHEN a super admin queries warehouses, THE System SHALL return all warehouses regardless of access assignments

### Requirement 3: Point of Sale System - Sales Outlets

**User Story:** As a restaurant manager, I want to configure sales outlets for my property, so that I can manage different revenue centers.

#### Acceptance Criteria

1. THE System SHALL support creating Sales_Outlets of types: RESTAURANT, BAR, ROOM_SERVICE, POOL_BAR, CAFE, MINIBAR
2. WHEN creating a Sales_Outlet, THE System SHALL require linking it to a property and an inventory warehouse
3. WHEN a Sales_Outlet is deactivated, THE System SHALL prevent new orders but allow viewing historical data
4. THE System SHALL display only Sales_Outlets belonging to the current property scope

### Requirement 4: Point of Sale System - Table Management

**User Story:** As a restaurant host, I want to manage table layouts and statuses, so that I can efficiently seat guests and track table availability.

#### Acceptance Criteria

1. THE System SHALL maintain tables with number, capacity, status, and floor plan position
2. WHEN a table status changes, THE System SHALL update it to one of: AVAILABLE, OCCUPIED, RESERVED, DIRTY, OUT_OF_SERVICE
3. WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
4. WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
5. WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE

### Requirement 5: Point of Sale System - Order Management

**User Story:** As a server, I want to create and manage orders for guests, so that I can process their food and beverage requests.

#### Acceptance Criteria

1. WHEN creating an order, THE System SHALL generate a unique order number and associate it with an outlet and server
2. WHEN adding items to an order, THE System SHALL validate menu item availability and calculate line totals
3. WHEN an order is sent to kitchen, THE System SHALL update order status to SENT_TO_KITCHEN and route items to KDS
4. WHEN applying a discount to an order, THE System SHALL recalculate subtotal, tax, and total amounts
5. WHEN splitting a bill, THE System SHALL create separate payment records while maintaining order integrity
6. IF a menu item is unavailable (86'd), THEN THE System SHALL prevent adding it to orders and display unavailable status

### Requirement 6: Point of Sale System - Kitchen Display System

**User Story:** As a kitchen staff member, I want to see incoming orders on a display, so that I can prepare items in the correct sequence.

#### Acceptance Criteria

1. WHEN an order is sent to kitchen, THE System SHALL display order items on the KDS grouped by preparation station
2. WHEN a kitchen staff marks an item as preparing, THE System SHALL update the OrderItem status to PREPARING
3. WHEN a kitchen staff marks an item as ready, THE System SHALL update the OrderItem status to READY and notify the server
4. THE System SHALL display order age and highlight orders exceeding target preparation time
5. WHEN all items in an order are ready, THE System SHALL update the order status to READY

### Requirement 7: Point of Sale System - Payments

**User Story:** As a cashier, I want to process various payment methods, so that guests can pay for their orders conveniently.

#### Acceptance Criteria

1. THE System SHALL support payment methods: CASH, CREDIT_CARD, DEBIT_CARD, ROOM_CHARGE, VOUCHER, COMPLIMENTARY
2. WHEN processing a cash payment, THE System SHALL calculate and display change due
3. WHEN processing a room charge, THE System SHALL validate the booking is active and add the charge to the guest folio
4. WHEN processing a split payment, THE System SHALL create multiple OrderPayment records totaling the order amount
5. WHEN an order is fully paid, THE System SHALL update order status to PAID and record payment timestamp
6. IF a payment fails, THEN THE System SHALL maintain the order in OPEN status and log the failure reason

### Requirement 8: Room Service and Guest Charging

**User Story:** As a hotel guest, I want to order room service and charge it to my room, so that I can enjoy convenient dining without immediate payment.

#### Acceptance Criteria

1. WHEN creating a room service order, THE System SHALL require linking to an active booking
2. WHEN a guest charges to room, THE System SHALL validate the booking status is CONFIRMED and guest authorization
3. WHEN a room charge is processed, THE System SHALL add the order total to the booking's charges
4. THE System SHALL display guest preferences from their profile when creating room service orders
5. WHEN a guest checks out, THE System SHALL include all room charges in the final folio

### Requirement 9: Purchase Order System

**User Story:** As a purchasing manager, I want to create and manage purchase orders, so that I can efficiently procure inventory from suppliers.

#### Acceptance Criteria

1. WHEN creating a Purchase_Order, THE System SHALL generate a unique PO number and set status to DRAFT
2. WHEN submitting a PO for approval, THE System SHALL update status to PENDING_APPROVAL and notify approvers
3. WHEN a PO is approved, THE System SHALL update status to APPROVED and allow sending to supplier
4. WHEN receiving stock against a PO, THE System SHALL create stock movements and update received quantities
5. WHEN partial receiving occurs, THE System SHALL update PO status to PARTIALLY_RECEIVED
6. WHEN all PO items are fully received, THE System SHALL update PO status to RECEIVED
7. IF stock level falls below par level, THEN THE System SHALL suggest creating a PO for that item

### Requirement 10: Supplier Management UI

**User Story:** As an inventory manager, I want to manage supplier information through a user interface, so that I can maintain accurate vendor records.

#### Acceptance Criteria

1. THE System SHALL display a searchable list of suppliers filtered by current property scope
2. WHEN creating a supplier, THE System SHALL capture name, contact details, and payment terms
3. WHEN editing a supplier, THE System SHALL validate required fields and save changes
4. WHEN deactivating a supplier, THE System SHALL prevent new POs but maintain historical records
5. THE System SHALL display supplier performance metrics including delivery accuracy and response time

### Requirement 11: Stock Category Management UI

**User Story:** As an inventory manager, I want to manage stock categories through a user interface, so that I can organize inventory items effectively.

#### Acceptance Criteria

1. THE System SHALL display a list of stock categories with item counts
2. WHEN creating a category, THE System SHALL capture name, description, and optional color code
3. WHEN editing a category, THE System SHALL update all associated stock items
4. WHEN deleting a non-system category with no items, THE System SHALL remove it from the database
5. IF a category has associated items, THEN THE System SHALL prevent deletion and display an error

### Requirement 12: Audit Trail System

**User Story:** As a compliance officer, I want all system changes to be logged, so that I can track who made what changes and when.

#### Acceptance Criteria

1. WHEN any inventory operation occurs, THE System SHALL create an AuditLog record with user, action, entity, and timestamp
2. THE AuditLog SHALL capture old values and new values for update operations
3. WHEN querying audit logs, THE System SHALL support filtering by user, entity type, date range, and action
4. THE System SHALL retain audit logs according to configured retention policy
5. THE System SHALL capture IP address and user agent for each audit entry

### Requirement 13: Shift Management

**User Story:** As a cashier, I want to open and close shifts with cash reconciliation, so that I can account for all transactions during my work period.

#### Acceptance Criteria

1. WHEN opening a shift, THE System SHALL record the outlet, cashier, and starting cash amount
2. WHILE a shift is open, THE System SHALL associate all orders processed by that cashier with the shift
3. WHEN closing a shift, THE System SHALL require ending cash count and calculate expected cash
4. WHEN a shift is closed, THE System SHALL calculate variance between expected and actual cash
5. THE System SHALL generate a shift report showing all transactions, payments by method, and variance

### Requirement 14: Approval Workflows

**User Story:** As a manager, I want sensitive operations to require approval, so that I can maintain control over significant inventory and financial changes.

#### Acceptance Criteria

1. WHEN a stock adjustment exceeds threshold, THE System SHALL require manager approval before execution
2. WHEN a waste record is created, THE System SHALL route it for approval based on value threshold
3. WHEN a PO exceeds budget threshold, THE System SHALL require additional approval level
4. WHEN an approver approves an item, THE System SHALL record approver ID and timestamp
5. WHEN an approver rejects an item, THE System SHALL record rejection reason and notify requester

### Requirement 15: Notifications and Alerts

**User Story:** As a warehouse manager, I want to receive alerts for important events, so that I can take timely action on critical issues.

#### Acceptance Criteria

1. WHEN stock level falls below par level, THE System SHALL create a LOW_STOCK notification for warehouse managers
2. WHEN a PO requires approval, THE System SHALL create a PO_APPROVAL notification for approvers
3. WHEN a requisition status changes, THE System SHALL create a REQUISITION_STATUS notification for the requester
4. WHEN a batch is expiring within configured days, THE System SHALL create an EXPIRING_BATCH notification
5. THE System SHALL display unread notification count in the UI header
6. WHEN a user reads a notification, THE System SHALL mark it as read with timestamp

### Requirement 16: Dashboard and Analytics

**User Story:** As a property manager, I want to view key performance indicators on a dashboard, so that I can monitor business performance at a glance.

#### Acceptance Criteria

1. THE System SHALL display inventory value by warehouse for the current property
2. THE System SHALL display sales by outlet with daily, weekly, and monthly views
3. THE System SHALL display food cost percentage trends over time
4. THE System SHALL display waste analysis by category and reason
5. THE System SHALL support exporting dashboard data to PDF and Excel formats
6. WHEN viewing "All Properties", THE System SHALL display consolidated metrics across properties

### Requirement 17: Bulk Operations

**User Story:** As an inventory manager, I want to perform bulk data operations, so that I can efficiently manage large volumes of inventory data.

#### Acceptance Criteria

1. WHEN importing stock items from CSV, THE System SHALL validate data format and report errors
2. WHEN bulk updating prices, THE System SHALL apply changes to all selected items atomically
3. WHEN exporting data, THE System SHALL generate CSV/Excel files with all relevant fields
4. IF bulk import contains errors, THEN THE System SHALL reject the entire import and display error details
5. THE System SHALL provide import templates with required field specifications

