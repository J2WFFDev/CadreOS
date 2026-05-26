import type {
  GearCategoryBehaviorType,
  GearCustodyMode,
  GearIdentifierType,
  GearInventoryType,
  GearLocationClassification,
  GearMaintenanceFrequency,
  GearReportGroup,
} from "@prisma/client";

export type GearCategoryTemplateSlug =
  | "firearm"
  | "magazine-set"
  | "ammunition"
  | "radio"
  | "tablet-electronic"
  | "first-aid-kit"
  | "tool"
  | "uniform-apparel"
  | "sports-equipment"
  | "kit-bundle"
  | "trailer-large-equipment"
  | "generic-asset";

export type GearCategoryConfigDefaults = {
  inventoryType: GearInventoryType;
  templateSlug: GearCategoryTemplateSlug | null;
  behaviorType: GearCategoryBehaviorType;
  custodyMode: GearCustodyMode;
  requiresReturnInspection: boolean;
  requiresMaintenanceTracking: boolean;
  maintenanceFrequency: GearMaintenanceFrequency | null;
  maintenanceIntervalDays: number | null;
  primaryIdentifierType: GearIdentifierType;
  supportsConsumableTracking: boolean;
  consumableLowStockDefault: number | null;
  supportsEventDeployment: boolean;
  reportGroup: GearReportGroup;
  reportLabel: string | null;
  isKitContainer: boolean;
  guardianApprovalRequired: boolean;
};

export type GearCategoryTemplateDef = {
  slug: GearCategoryTemplateSlug;
  displayName: string;
  description: string;
  defaults: GearCategoryConfigDefaults;
};

function createTemplate(
  slug: GearCategoryTemplateSlug,
  displayName: string,
  description: string,
  defaults: Omit<GearCategoryConfigDefaults, "templateSlug">,
): GearCategoryTemplateDef {
  return {
    slug,
    displayName,
    description,
    defaults: {
      ...defaults,
      templateSlug: slug,
    },
  };
}

export const GEAR_CATEGORY_STARTER_TEMPLATES: GearCategoryTemplateDef[] = [
  createTemplate("firearm", "Firearm", "Assigned serialized firearms with maintenance and guardian controls.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "STAFF_ASSIGNMENT_ONLY",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "SERIAL_NUMBER",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "FIREARMS",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: true,
  }),
  createTemplate("magazine-set", "Magazine Set", "Grouped durable magazines managed as assigned gear kits.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "STAFF_ASSIGNMENT_ONLY",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: false,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "SERIAL_NUMBER",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "FIREARMS",
    reportLabel: null,
    isKitContainer: true,
    guardianApprovalRequired: false,
  }),
  createTemplate("ammunition", "Ammunition", "Consumable stock with barcode scanning and low-stock tracking.", {
    inventoryType: "CONSUMABLE",
    behaviorType: "CONSUMABLE",
    custodyMode: "NO_CUSTODY",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: false,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "BARCODE",
    supportsConsumableTracking: true,
    consumableLowStockDefault: 50,
    supportsEventDeployment: true,
    reportGroup: "CONSUMABLES",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("radio", "Radio", "Assigned communications equipment with asset tags and maintenance tracking.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "ASSET_TAG",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "COMMUNICATIONS",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("tablet-electronic", "Tablet / Electronic", "Durable electronics with asset tags and maintenance oversight.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "ASSET_TAG",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "ELECTRONICS",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("first-aid-kit", "First Aid Kit", "Shared medical kits that require maintenance and return inspection.", {
    inventoryType: "DURABLE",
    behaviorType: "SHARED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: true,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "MANUAL_LOOKUP",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "MEDICAL",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("tool", "Tool", "Shared durable tools with serialized tracking and maintenance history.", {
    inventoryType: "DURABLE",
    behaviorType: "SHARED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "SERIAL_NUMBER",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "TOOLS",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("uniform-apparel", "Uniform / Apparel", "Assigned apparel managed by staff without custody checkouts.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "STAFF_ASSIGNMENT_ONLY",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: false,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "MANUAL_LOOKUP",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "APPAREL",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("sports-equipment", "Sports Equipment", "Assigned athletic equipment with durable maintenance tracking.", {
    inventoryType: "DURABLE",
    behaviorType: "ASSIGNED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: true,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "SERIAL_NUMBER",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "ATHLETIC_EQUIPMENT",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
  createTemplate("kit-bundle", "Kit Bundle", "Shared grouped assets tracked as a reusable kit container.", {
    inventoryType: "DURABLE",
    behaviorType: "SHARED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: false,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "MANUAL_LOOKUP",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "GENERAL",
    reportLabel: null,
    isKitContainer: true,
    guardianApprovalRequired: false,
  }),
  createTemplate(
    "trailer-large-equipment",
    "Trailer / Large Equipment",
    "Shared large assets that require approvals, inspections, and deployment readiness.",
    {
      inventoryType: "DURABLE",
      behaviorType: "SHARED_GEAR",
      custodyMode: "REQUIRES_APPROVAL",
      requiresReturnInspection: true,
      requiresMaintenanceTracking: true,
      maintenanceFrequency: null,
      maintenanceIntervalDays: null,
      primaryIdentifierType: "SERIAL_NUMBER",
      supportsConsumableTracking: false,
      consumableLowStockDefault: null,
      supportsEventDeployment: true,
      reportGroup: "VEHICLES_LARGE_EQUIPMENT",
      reportLabel: null,
      isKitContainer: false,
      guardianApprovalRequired: false,
    },
  ),
  createTemplate("generic-asset", "Generic Asset", "General-purpose durable asset configuration starter.", {
    inventoryType: "DURABLE",
    behaviorType: "SHARED_GEAR",
    custodyMode: "FREE_CHECKOUT",
    requiresReturnInspection: false,
    requiresMaintenanceTracking: false,
    maintenanceFrequency: null,
    maintenanceIntervalDays: null,
    primaryIdentifierType: "SERIAL_NUMBER",
    supportsConsumableTracking: false,
    consumableLowStockDefault: null,
    supportsEventDeployment: true,
    reportGroup: "GENERAL",
    reportLabel: null,
    isKitContainer: false,
    guardianApprovalRequired: false,
  }),
];

export function getGearCategoryTemplate(slug: string): GearCategoryTemplateDef | undefined {
  return GEAR_CATEGORY_STARTER_TEMPLATES.find((template) => template.slug === slug);
}

export function applyGearCategoryTemplate(slug: string): Partial<GearCategoryConfigDefaults> {
  const template = getGearCategoryTemplate(slug);
  return template?.defaults ? { ...template.defaults } : {};
}

export function isCategoryDurable(behaviorType: GearCategoryBehaviorType): boolean {
  return behaviorType !== "CONSUMABLE";
}

export function isCategoryConsumable(behaviorType: GearCategoryBehaviorType): boolean {
  return behaviorType === "CONSUMABLE";
}

function formatEnumValue(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatGearCategoryBehavior(behaviorType: GearCategoryBehaviorType): string {
  return formatEnumValue(behaviorType);
}

export function formatGearCustodyMode(mode: GearCustodyMode): string {
  return formatEnumValue(mode);
}

export function formatGearIdentifierType(type: GearIdentifierType): string {
  return formatEnumValue(type);
}

export function formatGearReportGroup(group: GearReportGroup): string {
  return formatEnumValue(group);
}

export function formatGearLocationClassification(loc: GearLocationClassification): string {
  return formatEnumValue(loc);
}

export function getReportGroupBadgeClass(group: GearReportGroup): string {
  switch (group) {
    case "FIREARMS":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    case "COMMUNICATIONS":
    case "ELECTRONICS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "MEDICAL":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "ATHLETIC_EQUIPMENT":
    case "APPAREL":
      return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
    case "TOOLS":
    case "VEHICLES_LARGE_EQUIPMENT":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "CONSUMABLES":
      return "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200";
    case "GENERAL":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}
