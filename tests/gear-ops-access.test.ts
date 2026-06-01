import assert from "node:assert/strict";
import test from "node:test";

import { buildGearReservationVisibilityWhere } from "@/lib/gear-ops-access";

test("buildGearReservationVisibilityWhere scopes reservations to visible gear items", () => {
  const where = buildGearReservationVisibilityWhere({
    organizationId: "org_123",
    gearItemWhere: {
      organizationId: "org_123",
      OR: [{ programId: { in: ["program_1"] } }],
    },
  });

  assert.equal(where.organizationId, "org_123");
  assert.equal(Array.isArray(where.OR), true);
  assert.equal(where.OR?.length, 3);

  const [itemScope, kitScope, dynamicScope] = where.OR ?? [];

  assert.deepEqual(itemScope, {
    gearItem: {
      AND: [
        {
          organizationId: "org_123",
          OR: [{ programId: { in: ["program_1"] } }],
        },
      ],
    },
  });

  assert.deepEqual(kitScope, {
    inventoryKit: {
      items: {
        some: {
          removedAt: null,
          gearItem: {
            AND: [
              {
                organizationId: "org_123",
                OR: [{ programId: { in: ["program_1"] } }],
              },
            ],
          },
        },
      },
    },
  });

  assert.deepEqual(dynamicScope, {
    dynamicKitAllocation: {
      items: {
        some: {
          gearItem: {
            AND: [
              {
                organizationId: "org_123",
                OR: [{ programId: { in: ["program_1"] } }],
              },
            ],
          },
        },
      },
    },
  });
});
