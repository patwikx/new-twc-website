# Requirements: Cycle Count Process

## Overview

The cycle count process enables systematic physical inventory verification to maintain inventory accuracy. It supports various count types (full, ABC classification, random, spot), variance tracking, approval workflows, and automatic adjustments.

## Functional Requirements

### 1. Cycle Count Planning

#### 1.1 Create Cycle Count Session
- **ID**: REQ-CC-1.1
- **Description**: Users can create a cycle count session for a specific warehouse
- **Acceptance Criteria**:
  - User selects warehouse and count type
  - System generates unique count number (CC-YYYY-NNNN)
  - User can add specific items or auto-populate based on count type
  - Session starts in DRAFT status

#### 1.2 Count Types
- **ID**: REQ-CC-1.2
- **Description**: System supports multiple count types for different scenarios
- **Acceptance Criteria**:
  - FULL: All items in warehouse
  - ABC_CLASS_A: High-value items (top 20% by value)
  - ABC_CLASS_B: Medium-value items (next 30% by value)
  - ABC_CLASS_C: Low-value items (bottom 50% by value)
  - RANDOM: Random sample (configurable %)
  - SPOT: User-selected specific items

#### 1.3 Schedule Counts
- **ID**: REQ-CC-1.3
- **Description**: Users can schedule cycle counts for future dates
- **Acceptance Criteria**:
  - User sets scheduled date/time
  - Status changes to SCHEDULED
  - Scheduled counts appear in upcoming counts list

### 2. Count Execution

#### 2.1 Start Cycle Count
- **ID**: REQ-CC-2.1
- **Description**: Starting a count locks system quantities as baseline
- **Acceptance Criteria**:
  - System snapshots current quantities for all items in count
  - Status changes to IN_PROGRESS
  - startedAt timestamp recorded
  - No further items can be added after start

#### 2.2 Record Physical Counts
- **ID**: REQ-CC-2.2
- **Description**: Users enter physical count quantities
- **Acceptance Criteria**:
  - User enters counted quantity for each item
  - System records who counted and when
  - Optional notes per item
  - Partial saves allowed (not all items required at once)

#### 2.3 Blind Count Option
- **ID**: REQ-CC-2.3
- **Description**: Option to hide system quantities from counters
- **Acceptance Criteria**:
  - When enabled, counters cannot see system quantity
  - Reduces bias in counting
  - Configurable per cycle count session

#### 2.4 Batch-Level Counting
- **ID**: REQ-CC-2.4
- **Description**: Support counting at batch/lot level for tracked items
- **Acceptance Criteria**:
  - Items with batch tracking show individual batches
  - Each batch counted separately
  - Expiration dates visible for verification

### 3. Variance Analysis

#### 3.1 Calculate Variances
- **ID**: REQ-CC-3.1
- **Description**: System calculates variance between system and physical counts
- **Acceptance Criteria**:
  - Variance = Counted Quantity - System Quantity
  - Variance % = (Variance / System Quantity) × 100
  - Variance Cost = Variance × Weighted Average Cost

#### 3.2 Variance Thresholds
- **ID**: REQ-CC-3.2
- **Description**: Highlight significant variances for review
- **Acceptance Criteria**:
  - Configurable threshold (e.g., >5% or >₱1000)
  - Items exceeding threshold flagged
  - Summary of items requiring attention

#### 3.3 Submit for Review
- **ID**: REQ-CC-3.3
- **Description**: Counters submit completed count for manager review
- **Acceptance Criteria**:
  - All items must have counts entered
  - Status changes to PENDING_REVIEW
  - Notification to approvers (optional)

### 4. Approval Workflow

#### 4.1 Review Variances
- **ID**: REQ-CC-4.1
- **Description**: Managers review variance report before approval
- **Acceptance Criteria**:
  - View all items with variances
  - Sort/filter by variance amount, percentage, cost
  - Add notes/explanations per item

#### 4.2 Approve Cycle Count
- **ID**: REQ-CC-4.2
- **Description**: Manager approves count and triggers adjustments
- **Acceptance Criteria**:
  - Approval requires appropriate permission
  - Status changes to COMPLETED
  - approvedById and completedAt recorded

#### 4.3 Create Adjustments
- **ID**: REQ-CC-4.3
- **Description**: Approved variances automatically create stock adjustments
- **Acceptance Criteria**:
  - Each variance creates ADJUSTMENT movement
  - Reason auto-populated: "Cycle Count: {countNumber}"
  - Stock levels updated to match physical count
  - Reference links adjustment to cycle count item

#### 4.4 Reject/Recount
- **ID**: REQ-CC-4.4
- **Description**: Manager can reject count and request recount
- **Acceptance Criteria**:
  - Status returns to IN_PROGRESS
  - Previous counts cleared or retained (configurable)
  - Rejection reason recorded

### 5. Reporting & Analytics

#### 5.1 Cycle Count Report
- **ID**: REQ-CC-5.1
- **Description**: Detailed report for each cycle count session
- **Acceptance Criteria**:
  - List all items with system qty, counted qty, variance
  - Total variance cost (positive and negative)
  - Count accuracy percentage
  - Export to PDF/Excel

#### 5.2 Inventory Accuracy Metrics
- **ID**: REQ-CC-5.2
- **Description**: Track inventory accuracy over time
- **Acceptance Criteria**:
  - Accuracy % = Items with zero variance / Total items counted
  - Track by warehouse, category, time period
  - Trend charts showing accuracy improvement

#### 5.3 Variance Analysis Report
- **ID**: REQ-CC-5.3
- **Description**: Analyze patterns in inventory variances
- **Acceptance Criteria**:
  - Top items by variance frequency
  - Top items by variance cost
  - Variance by category/warehouse
  - Identify shrinkage patterns

### 6. Integration

#### 6.1 Stock Movement Integration
- **ID**: REQ-CC-6.1
- **Description**: Cycle count adjustments integrate with stock movement system
- **Acceptance Criteria**:
  - Adjustments use existing adjustStock function
  - Movement type: ADJUSTMENT
  - Full audit trail maintained

#### 6.2 Batch Tracking Integration
- **ID**: REQ-CC-6.2
- **Description**: Batch-level counts update batch quantities
- **Acceptance Criteria**:
  - Batch quantities adjusted individually
  - Expired batches can be identified during count
  - FEFO order maintained after adjustments

## Non-Functional Requirements

### 7. Performance
- **ID**: REQ-CC-7.1
- **Description**: System handles large counts efficiently
- **Acceptance Criteria**:
  - Support 1000+ items per cycle count
  - Count entry responsive (<500ms)
  - Variance calculation <2 seconds

### 8. Security
- **ID**: REQ-CC-8.1
- **Description**: Appropriate access controls
- **Acceptance Criteria**:
  - Permission: cycle-count:create
  - Permission: cycle-count:count (enter counts)
  - Permission: cycle-count:approve
  - Permission: cycle-count:view-reports

## User Stories

1. As a **warehouse manager**, I want to schedule regular cycle counts so that inventory accuracy is maintained.

2. As a **stock clerk**, I want to enter physical counts without seeing system quantities so that my counts are unbiased.

3. As a **inventory controller**, I want to review variances before approval so that I can investigate significant discrepancies.

4. As a **finance manager**, I want to see the cost impact of inventory variances so that I can track shrinkage.

5. As an **operations manager**, I want to track inventory accuracy trends so that I can measure improvement over time.
