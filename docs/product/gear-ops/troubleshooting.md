# GearOps Troubleshooting Guide

Use this guide for common field and admin issues.

## Cannot find gear

- verify organization/program/team scope visibility
- search by barcode value, serial, SKU, and item name
- try **Scan inventory** with lookup context

## Scan does not work

- verify scan context selection
- try manual entry lookup fallback
- if offline, confirm action is queueable and check pending panel

## Item says unavailable

Common causes:
- active checkout
- active assignment
- maintenance/out-of-service state
- readiness not deployable

Resolve blocking state before checkout/assignment.

## Item is out of service

- review lifecycle/readiness state
- inspect maintenance and condition history
- complete required maintenance workflow before redeployment

## Pending action did not sync

- open pending panel
- review error message
- retry action when online
- if still failing, open original workflow and re-submit manually

## Checkout is blocked

- confirm no active conflicting custody
- confirm item is not maintenance/out-of-service
- confirm role has required staff access

## Category does not appear

- verify organization context and role scope
- confirm category exists in **GearOps → Categories**
- if scoped access is narrow, confirm category has visible in-scope items

## Template defaults are wrong

- verify which starter template was used
- edit category configuration after creation
- document local override decisions in admin notes

## Event gear is missing

- review event **Missing / unreturned view**
- confirm requirement gap vs unreturned deployment
- trace linked checkout records and latest custody owner

## Dashboard count looks wrong

- clear filters and re-check scope
- validate item lifecycle/readiness values on drill-down pages
- verify whether pending local actions are unconfirmed (not in confirmed history)

## Event template does not assign as expected

- confirm template is active and category linkage is correct
- remember templates are reusable requirement definitions, not automatic event assignment
- add requirements and assignments from the event gear page

## Guardian approval blocks or warns unexpectedly

- verify category `guardianApprovalRequired` value
- verify guardian relationships for athlete-linked assignment context
- confirm organization-level expectations with current RC guardian boundary limits

## Consumable count looks wrong

- review consumable transaction history for adjustments/distribution/disposal
- verify quantity threshold configuration
- verify pending/offline actions have reached server-confirmed completion

## Permission/access issue

- GearOps workflows are staff-scoped
- admin settings require organization admin
- if scope is incomplete/ambiguous, contact org admin for role scope correction
