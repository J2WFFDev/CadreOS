# GearOps Operator Quick Start

Use this guide for coaches, field operators, and volunteers handling gear during daily operations.

## When to Use This

Use this when you need to issue, return, locate, or verify gear quickly in the field.

## 1) Start in the Right Place

- For scan-first work: **GearOps → Scan**
- For search-first work: **GearOps → Items**
- For one specific item: **GearOps → Items → [Item]**

## 2) Find or Scan Gear

- In **Items**, search by name, barcode/QR value, serial, or SKU.
- In **Scan**, pick the scan context:
  - Lookup
  - Check-out
  - Check-in
  - Assignment
  - Readiness verify
  - Vault/cage
  - Audit prep

## 3) Check Out Gear

1. Open the item.
2. Use checkout flow (scan-first or item checkout).
3. Confirm checked-out-to person and expected return.
4. Save.

If item is unavailable (already checked out/assigned, maintenance, out of service), resolve that state before issuing.

## 4) Check In Gear

1. Open active checkout record.
2. Set status to returned/check-in.
3. Capture return details and condition on return.
4. Save.

## 5) Transfer Custody or Assignment

- Close current open custody first.
- Then create the new assignment/checkout to the new person/team/event.

## 6) Verify Readiness and Condition

- Use readiness verification from scan or item detail.
- Update condition notes when item quality changed.
- Log maintenance if service is needed.

## 7) Report Damage or Maintenance Need

1. Open item.
2. Add maintenance log (include notes and condition before/after when known).
3. Mark maintenance flag during recovery workflows when needed.

## 8) Event Return / Recovery

After event return:
- check in all deployed items
- complete recovery to storage location
- flag missing/unreturned items
- log maintenance and damage notes immediately

## 9) Pending/Offline Safety Rules

- A pending item is **not complete** until server confirmed.
- Use pending panel to retry/discard local actions.
- Do not assume custody changed until confirmed history shows it.

## Fast Field Example

“Coach needs radios now”:
1. Scan each radio in **CHECKOUT** context.
2. Confirm checked-out-to and return expectation.
3. Verify entries appear as confirmed custody records.
4. At return, scan in **CHECKIN** context and complete check-in.
