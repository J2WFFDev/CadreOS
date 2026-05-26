# GearOps Admin Configuration Guide (Overview)

Use this overview to orient administrators before applying category, template, location, or organization-level GearOps changes.

For full operational detail, use the deep guide:
- [GearOps Administrator Configuration Deep Guide (Arc 20P)](./admin-configuration-deep-guide.md)

## Admin Work Areas

- **GearOps → Categories**
- **GearOps → Event Templates**
- **GearOps → Admin (Settings)**
- **GearOps → Locations**
- **GearOps → Kits**
- **GearOps → Reports**

## Role Boundary Summary

- **Administrators:** configuration and governance (categories, templates, settings, naming conventions, reporting grouping).
- **Operators/staff:** day-to-day execution (scan, checkout/check-in, assignment, maintenance logging, consumable transactions, event gear workflows).

## Configuration Surfaces (at a glance)

- **Organization defaults:** baseline custody/report grouping and GearOps capability toggles.
- **Category config:** behavior, custody, identifier, maintenance/readiness flags, consumable defaults, event support, guardian boundary flag.
- **Template config:** category starter profiles and event requirement template rows.
- **Location/kit config:** storage hierarchy, location code strategy, grouped loadout structure.

## High-Impact Changes (control carefully)

- custody mode changes
- identifier strategy changes
- guardian boundary changes
- consumable tracking threshold changes
- report grouping and report labels

Always verify these in a pilot workflow after changing configuration.

## Recommended Next Reading

1. [Admin Configuration Deep Guide](./admin-configuration-deep-guide.md)
2. [Readiness and Maintenance Guide](./readiness-maintenance-guide.md)
3. [Reporting and Dashboard Guide](./reporting-dashboard-guide.md)
4. [Mobile and Offline Behavior Guide](./mobile-offline-guide.md)
5. [Known Limitations and Deferred Scope](./known-limitations-and-deferred-scope.md)
