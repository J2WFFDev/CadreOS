/**
 * Arc 20Z: GearOps human-readable Asset ID generation.
 *
 * Asset IDs use the format: GO-{CATCODE}-{NNNN}
 * - GO: GearOps prefix
 * - CATCODE: up to 6-char uppercase alphanumeric code derived from the category name
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
 * Derive a short uppercase alphanumeric code (up to 6 chars) from a category name.
 * Non-alphanumeric characters are stripped; the result is truncated to 6 chars.
 * Falls back to "ITEM" if the derived code would be empty.
 *
 * @example
 * deriveCategoryCode("Rifle") => "RIFLE"
 * deriveCategoryCode("Night Vision") => "NIGHTV"
 * deriveCategoryCode("3M Tape") => "3MTAPE"
 * deriveCategoryCode("Body Armor") => "BODYA"
 * deriveCategoryCode("!!! ---") => "ITEM"
 */
export function deriveCategoryCode(categoryName: string): string {
  const code = categoryName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
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

  // Fallback: use a random 4-digit number (1000–9999) to guarantee uniqueness
  // while keeping the suffix in the expected numeric format.
  const fallbackSuffix = String(Math.floor(9000 * Math.random()) + 1000);
  return `GO-${categoryCode}-${fallbackSuffix}`;
}

/**
 * Validate the format of a caller-supplied Asset ID override.
 * Returns an error message string if invalid, or null if valid.
 *
 * Allowed format: GO-{1-6 uppercase alphanumeric chars}-{1-8 alphanumeric chars}
 * The category code segment is capped at 6 chars (matching deriveCategoryCode).
 * The suffix segment allows up to 8 alphanumeric chars to accommodate manual/legacy IDs.
 */
export function validateAssetIdFormat(value: string): string | null {
  if (!value.trim()) {
    return null; // Empty is allowed (auto-generate will be used instead)
  }

  if (!/^GO-[A-Z0-9]{1,6}-[A-Z0-9]{1,8}$/.test(value.trim())) {
    return 'Asset ID must match the format GO-{CODE}-{SUFFIX} where CODE is up to 6 alphanumeric characters and SUFFIX is up to 8 alphanumeric characters, e.g. GO-RIFLE-0007.';
  }

  return null;
}
