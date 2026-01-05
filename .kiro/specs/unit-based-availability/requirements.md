# Requirements Document

## Introduction

This feature enhances the room availability system to properly account for multiple room units per room type. Currently, the system checks if any booking exists for a room type, but it should check if there are still available units within that room type for the requested dates. This enables accurate availability display in the booking calendar and prevents false "sold out" scenarios when units are still available.

## Glossary

- **Room_Type**: A category of room (e.g., "Deluxe Suite", "Standard Room") defined in the Room model
- **Room_Unit**: An individual physical room belonging to a Room_Type (e.g., Room 101, Room 102)
- **Availability_Service**: The service responsible for checking room availability
- **Booking_Widget**: The public-facing component where guests select dates and check availability
- **Date_Range_Picker**: The calendar component used for selecting check-in and check-out dates
- **Overlapping_Booking**: A booking whose date range intersects with the requested date range

## Requirements

### Requirement 1: Unit-Based Availability Calculation

**User Story:** As a guest, I want the system to show room availability based on actual unit inventory, so that I can book rooms that are truly available even when some units are already booked.

#### Acceptance Criteria

1. WHEN checking availability for a Room_Type, THE Availability_Service SHALL count the total number of active Room_Units for that Room_Type
2. WHEN checking availability for a Room_Type, THE Availability_Service SHALL count the number of Overlapping_Bookings (CONFIRMED or PENDING status) for the requested date range
3. THE Availability_Service SHALL determine a Room_Type as available IF the count of Overlapping_Bookings is less than the count of active Room_Units
4. THE Availability_Service SHALL return the number of remaining available units along with the availability status
5. IF all Room_Units are booked for the requested dates, THEN THE Availability_Service SHALL mark the Room_Type as unavailable

### Requirement 2: Calendar Date Availability Display

**User Story:** As a guest, I want to see which dates have available rooms in the calendar, so that I can easily find dates when I can book.

#### Acceptance Criteria

1. WHEN displaying the Date_Range_Picker for a specific Room_Type, THE System SHALL fetch availability data for the visible date range
2. WHEN a date has zero available units, THE Date_Range_Picker SHALL visually indicate that date as unavailable (disabled/grayed out)
3. WHEN a date has limited availability (less than 50% of units available), THE Date_Range_Picker SHALL visually indicate limited availability
4. THE System SHALL prevent selection of date ranges that span unavailable dates
5. WHEN the user hovers over a date, THE System SHALL display a tooltip showing the number of available units

### Requirement 3: Booking Widget Availability Check

**User Story:** As a guest, I want the booking widget to show accurate room availability based on my selected dates, so that I only see rooms I can actually book.

#### Acceptance Criteria

1. WHEN a guest clicks "Check Availability" in the Booking_Widget, THE System SHALL query unit-based availability for all Room_Types at the selected property
2. THE Booking_Widget SHALL only display Room_Types that have at least one available unit for the entire selected date range
3. THE Booking_Widget SHALL display the number of remaining units for each available Room_Type
4. IF a Room_Type has low availability (1-2 units remaining), THE Booking_Widget SHALL display a "Limited Availability" indicator
5. THE Booking_Widget SHALL update availability in real-time when dates are changed

### Requirement 4: Booking Page Date Validation

**User Story:** As a guest, I want the booking page to validate my selected dates against current availability, so that I don't proceed with a booking that will fail.

#### Acceptance Criteria

1. WHEN a guest changes dates on the booking page, THE System SHALL re-validate availability for the selected Room_Type
2. IF the new dates result in no available units, THEN THE System SHALL display an error message and prevent booking submission
3. THE System SHALL show the number of available units for the currently selected dates
4. WHEN dates are changed in cart mode, THE System SHALL validate availability for each cart item independently

### Requirement 5: Concurrent Booking Protection

**User Story:** As a system operator, I want the booking system to handle concurrent booking attempts correctly, so that we don't oversell room inventory.

#### Acceptance Criteria

1. WHEN creating a booking, THE System SHALL perform a final availability check within a database transaction
2. IF availability has changed since the initial check, THEN THE System SHALL return an error and not create the booking
3. THE System SHALL use optimistic locking or row-level locking to prevent race conditions
4. WHEN a booking is cancelled, THE System SHALL immediately release the unit back to available inventory
