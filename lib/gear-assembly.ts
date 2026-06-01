import { db } from "@/lib/db";

export const GEAR_ASSEMBLY_RELATIONSHIP_TYPES = [
  "PRIMARY_COMPONENT",
  "ACCESSORY",
  "MOUNTED",
  "STOWED",
  "OTHER",
] as const;

export type GearAssemblyRelationshipType = (typeof GEAR_ASSEMBLY_RELATIONSHIP_TYPES)[number];

export function formatGearAssemblyRelationshipType(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function listActiveAssemblyEdges(organizationId: string) {
  return db.gearAssembly.findMany({
    where: { organizationId, isActive: true },
    select: { parentGearItemId: true, childGearItemId: true },
  });
}

export function wouldCreateCycleFromEdges(input: {
  parentGearItemId: string;
  childGearItemId: string;
  edges: Array<{ parentGearItemId: string; childGearItemId: string }>;
}) {
  if (input.parentGearItemId === input.childGearItemId) {
    return true;
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of input.edges) {
    const next = adjacency.get(edge.parentGearItemId);
    if (next) {
      next.push(edge.childGearItemId);
    } else {
      adjacency.set(edge.parentGearItemId, [edge.childGearItemId]);
    }
  }

  const queue = [input.childGearItemId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    if (current === input.parentGearItemId) {
      return true;
    }

    visited.add(current);
    for (const childId of adjacency.get(current) ?? []) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return false;
}

export async function wouldCreateGearAssemblyCycle(input: {
  organizationId: string;
  parentGearItemId: string;
  childGearItemId: string;
}) {
  const edges = await listActiveAssemblyEdges(input.organizationId);
  return wouldCreateCycleFromEdges({
    parentGearItemId: input.parentGearItemId,
    childGearItemId: input.childGearItemId,
    edges,
  });
}

export async function createGearAssemblyRelation(input: {
  organizationId: string;
  parentGearItemId: string;
  childGearItemId: string;
  relationshipType: string;
  notes?: string | null;
}) {
  if (await wouldCreateGearAssemblyCycle(input)) {
    throw new Error("Circular assembly relationships are not allowed.");
  }

  const [parent, child] = await Promise.all([
    db.gearItem.findFirst({
      where: { id: input.parentGearItemId, organizationId: input.organizationId },
      select: { id: true },
    }),
    db.gearItem.findFirst({
      where: { id: input.childGearItemId, organizationId: input.organizationId },
      select: { id: true },
    }),
  ]);

  if (!parent || !child) {
    throw new Error("Parent and child assets must both exist in the organization.");
  }

  const existing = await db.gearAssembly.findFirst({
    where: {
      organizationId: input.organizationId,
      parentGearItemId: input.parentGearItemId,
      childGearItemId: input.childGearItemId,
    },
    select: { id: true },
  });

  if (existing) {
    return db.gearAssembly.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        relationshipType: input.relationshipType,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });
  }

  return db.gearAssembly.create({
    data: {
      organizationId: input.organizationId,
      parentGearItemId: input.parentGearItemId,
      childGearItemId: input.childGearItemId,
      relationshipType: input.relationshipType,
      notes: input.notes ?? null,
      isActive: true,
    },
    select: { id: true },
  });
}

export async function deactivateGearAssemblyRelation(input: {
  organizationId: string;
  assemblyId: string;
}) {
  const existing = await db.gearAssembly.findFirst({
    where: { id: input.assemblyId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return db.gearAssembly.update({
    where: { id: existing.id },
    data: { isActive: false },
    select: { id: true },
  });
}
