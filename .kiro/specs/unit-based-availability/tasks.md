.000

...........................................


# Implementation Plan: Unit-Based Room Availability

## Overview

This plan implements unit-based room availability checking, enabling accurate availability display in calendars and booking widgets based on actual room unit inventory rather than just room type existence.

## Tasks

- [x] 1. Enhance AvailabilityService with unit-based calculations
  - [x] 1.1 Create `checkUnitAvailability` function in `lib/booking/availability.ts`
    - Query total active units for each room type
    - Count overlapping bookings (CONFIRMED/PENDING) for date range
    - Calculate availableUnits, available flag, and limitedAvailability flag
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test for availability calculation
    - **Property 1: Availability Calculation Correctness**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5**

  - [x] 1.3 Write property test for date overlap detection
    - **Property 2: Date Overlap Detection Accuracy**
    - **Validates: Requirements 1.2**

  - [x] 1.4 Create `getDateRangeAvailability` function for calendar display
    - Return daily availability for a date range
    - Include status classification (available/limited/unavailable)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.5 Write property test for date availability classification
    - **Property 3: Date Availability Classification**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 2. Create Availability API endpoints
  - [x] 2.1 Create `app/api/availability/route.ts` for single room type availability
    - GET endpoint with roomTypeId, checkIn, checkOut params
    - Return UnitAvailabilityResult
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Create `app/api/availability/calendar/route.ts` for calendar data
    - GET endpoint with roomTypeId and month params
    - Return DateAvailability[] for the month
    - _Requirements: 2.1_

  - [x] 2.3 Create `app/api/availability/bulk/route.ts` for multiple room types
    - POST endpoint accepting array of checks
    - Return availability for all room types at a property
    - _Requirements: 3.1_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance DateRangePicker with availability awareness
  - [x] 4.1 Create `useRoomAvailability` hook in `hooks/useRoomAvailability.ts`
    - Fetch availability data when roomTypeId is provided
    - Return disabledDates, limitedDates, and loading state
    - _Requirements: 2.1_

  - [x] 4.2 Update DateRangePicker component to accept availability props
    - Add disabled dates styling (grayed out)
    - Add limited availability styling (different color indicator)
    - Prevent selection of ranges with unavailable dates
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 4.3 Add availability tooltip on date hover
    - Show "X units available" on hover
    - _Requirements: 2.5_

- [x] 5. Enhance BookingWidget with unit-based availability
  - [x] 5.1 Update BookingWidget to use bulk availability API
    - Replace mock availability check with real API call
    - Filter room types to only show those with availableUnits > 0
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Display availability information in room cards
    - Show remaining units count
    - Add "Limited Availability" badge when availableUnits <= 2
    - _Requirements: 3.3, 3.4_

  - [x] 5.3 Write property test for room type filtering
    - **Property 4: Room Type Display Filtering**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Enhance Booking Page with availability validation
  - [x] 7.1 Add availability validation when dates change
    - Re-check availability on date change
    - Show error if no units available
    - Display available units count
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Add cart item independent validation
    - Validate each cart item separately when dates change
    - Show per-item availability errors
    - _Requirements: 4.4_

  - [x] 7.3 Write property test for booking validation
    - **Property 5: Booking Validation Consistency**
    - **Validates: Requirements 4.2, 4.4**

- [x] 8. Implement concurrent booking protection
  - [x] 8.1 Update `createBooking` action with transactional availability check
    - Wrap booking creation in database transaction
    - Re-check availability within transaction before creating
    - Return error if availability changed
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Write property test for concurrent booking protection
    - **Property 6: Concurrent Booking Protection**
    - **Validates: Requirements 5.2**

  - [x] 8.3 Update booking cancellation to release availability
    - Ensure cancelled bookings don't count toward booked units
    - _Requirements: 5.4_

  - [x] 8.4 Write property test for cancellation release
    - **Property 7: Cancellation Availability Release**
    - **Validates: Requirements 5.4**

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check with minimum 100 iterations
- Unit tests validate specific examples and edge cases
