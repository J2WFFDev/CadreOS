import { db } from "@/lib/db";
import { renderLabelSymbols } from "@/lib/inventory-labels";

export type LabelBatchFilter = {
  organizationId: string;
  categoryId?: string;
  locationId?: string;
  eventId?: string;
  itemIds?: string[];
};

export async function listLabelBatchItems(filter: LabelBatchFilter) {
  const itemIdSet = new Set((filter.itemIds ?? []).map((id) => id.trim()).filter(Boolean));

  const items = await db.gearItem.findMany({
    where: {
      organizationId: filter.organizationId,
      ...(filter.categoryId ? { gearCategoryId: filter.categoryId } : {}),
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
      ...(itemIdSet.size > 0 ? { id: { in: [...itemIdSet] } } : {}),
      ...(filter.eventId
        ? {
            OR: [
              { assignments: { some: { assignedToEventId: filter.eventId } } },
              { checkouts: { some: { eventId: filter.eventId } } },
              { eventGearAssignments: { some: { plan: { eventId: filter.eventId } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      serialNumber: true,
      barcodeValue: true,
      sku: true,
      category: { select: { name: true } },
      location: { select: { name: true } },
    },
    take: 400,
  });

  return Promise.all(
    items.map(async (item) => {
      const scanValue = item.barcodeValue?.trim() ? `BC:${item.barcodeValue.trim()}` : `ITEM:${item.id}`;
      const printableValue = item.barcodeValue?.trim() || item.serialNumber?.trim() || item.sku?.trim() || `ITEM-${item.id.slice(-6).toUpperCase()}`;
      const symbols = await renderLabelSymbols([{ kind: "QR", value: scanValue, label: "QR identifier" }]);

      return {
        id: item.id,
        name: item.name,
        categoryName: item.category.name,
        locationName: item.location?.name ?? "Unassigned",
        serialNumber: item.serialNumber,
        assetTag: item.barcodeValue,
        qrValue: scanValue,
        printableValue,
        hasMissingIdentifier: !item.barcodeValue?.trim() && !item.serialNumber?.trim() && !item.sku?.trim(),
        qrDataUri: symbols[0]?.dataUri ?? null,
      };
    }),
  );
}
