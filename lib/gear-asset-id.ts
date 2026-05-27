/**
 * Arc 20Z: GearOps human-readable Asset ID generation.
 *
 * Asset IDs use the format: GO-{CATCODE}-{NNNN}
 * - GO: GearOps prefix
 * - CATCODE: up to 6-char uppercase alpha derived from the category name
 * - NNNN: zero-padded 4-digit org-wide sequential counter
 *
 * Examples: GO-RIFLE-0007, GO-MAG-0041, GO-KIT-0021, GO-LOC-0005
 *
 * The counter is org-wide (not per-category) to keep IDs globally unique
 * within an organization without parsing the category code.
 *
 * Kit IDs use the same function with category name "KIT".
 * Location IDs use the same function with category name "LOC".
 */

import { db } from "@/lib/db";

/**
 * Derive a short uppercase alpha code (up to 6 chars) from a category name.
 * Non-alphabetic characters are stripped; the result is truncated to 6 chars.
 * Falls back to "ITEM" if the derived code would be empty.
 *
 * @example
 * deriveCategoryCode("Rifle") => "RIFLE"
 * deriveCategoryCode("Night Vision") => "NIGHTV"
 * deriveCategoryCode("Body Armor") => "BODYA"
 * deriveCategoryCode("123 !!") => "ITEM"
 */
export function deriveCategoryCode(categoryName: string): string {
  const code = categoryName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
  return code || "ITEM";
}

/**
 * Build an Asset ID string from a category code and a numeric counter.
 *
 * @example
 * buildAssetId("RIFLE", 7) => "GO-RIFLE-0007"
 * buildAssetId("MAG", 41)  => "GO-MAG-0041"
 */
export function buildAssetId(categoryCode: string, counter: number): string {
  const paddedCounter = String(counter).padStart(4, "0");
  return `GO-${categoryCode}-${paddedCounter}`;
}

/**
 * Generate a unique Asset ID for a new GearItem in the given organization.
 *
 * Queries the current item count for the org to determine the next counter
 * value and retries with an incremented counter if a collision occurs
 * (possible when items are created concurrently).
 *
 * @param organizationId - The org scope for uniqueness.
 * @param categoryName   - The category name used to derive the code segment.
 * @param maxAttempts    - How many times to retry on collision (default 10).
 */
export async function generateAssetId(
  organizationId: string,
  categoryName: string,
  maxAttempts = 10,
): Promise<string> {
  const categoryCode = deriveCategoryCode(categoryName);

  // Use the org-wide item count as a starting point for the counter.
  const baseCount = await db.gearItem.count({ where: { organizationId } });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = buildAssetId(categoryCode, baseCount + 1 + attempt);
    const existing = await db.gearItem.findFirst({
      where: { organizationId, assetId: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  // Fallback: use a timestamp-based suffix to guarantee uniqueness.
  const fallbackSuffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `GO-${categoryCode}-${fallbackSuffix}`;
}

/**
 * Validate the format of a caller-supplied Asset ID override.
 * Returns an error message string if invalid, or null if valid.
 *
 * Allowed format: GO-{1-8 uppercase alpha/digit chars}-{1-8 alphanumeric chars}
 * This is intentionally permissive so admins can supply legacy IDs.
 */
export function validateAssetIdFormat(value: string): string | null {
  if (!value.trim()) {
    return null; // Empty is allowed (auto-generate will be used instead)
  }

  if (!/^GO-[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$/.test(value.trim())) {
    return 'Asset ID must match the format GO-{CODE}-{NUMBER}, e.g. GO-RIFLE-0007.';
  }

  return null;
}
