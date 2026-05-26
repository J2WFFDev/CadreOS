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

## Event gear is missing

- review event **Missing / unreturned view**
- confirm requirement gap vs unreturned deployment
- trace linked checkout records and latest custody owner

## Dashboard count looks wrong

- clear filters and re-check scope
- validate item lifecycle/readiness values on drill-down pages
- verify whether pending local actions are unconfirmed (not in confirmed history)

## Permission/access issue

- GearOps workflows are staff-scoped
- admin settings require organization admin
- if scope is incomplete/ambiguous, contact org admin for role scope correction
