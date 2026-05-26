import type {
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

import { formatGearOpsEnum } from "@/lib/gear-ops";
import { labelForReadinessState } from "@/lib/inventory-ops";

export const INVENTORY_LABEL_TEMPLATE_KEYS = [
  "INVENTORY_ITEM",
  "INVENTORY_LOCATION",
  "KIT_LOADOUT",
  "CONSUMABLE",
  "CUSTODY_ASSIGNMENT",
  "TEMPORARY_OPERATIONAL",
] as const;

export type InventoryLabelTemplateKey = (typeof INVENTORY_LABEL_TEMPLATE_KEYS)[number];

export const INVENTORY_LABEL_FORMATS = ["COMPACT", "STANDARD", "WIDE"] as const;

export type InventoryLabelFormat = (typeof INVENTORY_LABEL_FORMATS)[number];

export const LABEL_SYMBOL_KINDS = ["QR", "CODE128"] as const;

export type LabelSymbolKind = (typeof LABEL_SYMBOL_KINDS)[number];

export type PrintableIdentifier = {
  label: string;
  displayValue: string;
  scanValue: string | null;
  futureWorkflowValue?: string | null;
  kind: "SCAN_READY" | "FUTURE_COMPATIBLE" | "TEXT_ONLY";
  description: string;
};

export type InventoryLabelTemplateDefinition = {
  key: InventoryLabelTemplateKey;
  label: string;
  description: string;
  formats: InventoryLabelFormat[];
  defaultFormat: InventoryLabelFormat;
  symbolKinds: LabelSymbolKind[];
};

export type InventoryLabelStatusTone = "ready" | "attention" | "neutral" | "inactive";

export type InventoryLabelSymbol = {
  kind: LabelSymbolKind;
  value: string;
  label: string;
};

export type LabelRenderContext = {
  templateKey: InventoryLabelTemplateKey;
  templateLabel: string;
  format: InventoryLabelFormat;
  title: string;
  subtitle: string;
  subjectName: string;
  organizationName: string;
  organizationIdentifier: string;
  printableIdentifier: PrintableIdentifier;
  statusLabel: string;
  statusTone: InventoryLabelStatusTone;
  hints: string[];
  footer: string;
  symbols: InventoryLabelSymbol[];
};

export type InventoryLabelPrintJob = {
  title: string;
  fileName: string;
  contentType: "text/html";
};

export type InventoryLabelPreview = {
  subjectType: "GEAR_ITEM" | "INVENTORY_LOCATION" | "INVENTORY_KIT";
  subjectId: string;
  template: InventoryLabelTemplateDefinition;
  availableTemplates: InventoryLabelTemplateDefinition[];
  renderContext: LabelRenderContext;
  printJob: InventoryLabelPrintJob;
};

export const INVENTORY_LABEL_TEMPLATES: Record<InventoryLabelTemplateKey, InventoryLabelTemplateDefinition> = {
  INVENTORY_ITEM: {
    key: "INVENTORY_ITEM",
    label: "Inventory label",
    description: "Scan-ready operational label for durable inventory identification.",
    formats: ["COMPACT", "STANDARD"],
    defaultFormat: "STANDARD",
    symbolKinds: ["CODE128", "QR"],
  },
  INVENTORY_LOCATION: {
    key: "INVENTORY_LOCATION",
    label: "Vault / cage label",
    description: "Operational location label for vaults, cages, shelves, and equipment areas.",
    formats: ["STANDARD", "WIDE"],
    defaultFormat: "WIDE",
    symbolKinds: ["CODE128", "QR"],
  },
  KIT_LOADOUT: {
    key: "KIT_LOADOUT",
    label: "Kit / loadout label",
    description: "Reusable kit identification label with contents and ownership hints.",
    formats: ["STANDARD"],
    defaultFormat: "STANDARD",
    symbolKinds: ["QR"],
  },
  CONSUMABLE: {
    key: "CONSUMABLE",
    label: "Consumable label",
    description: "Low-friction stock label with reorder and audit hints.",
    formats: ["COMPACT", "STANDARD"],
    defaultFormat: "COMPACT",
    symbolKinds: ["CODE128", "QR"],
  },
  CUSTODY_ASSIGNMENT: {
    key: "CUSTODY_ASSIGNMENT",
    label: "Assignment / custody label",
    description: "Operational custody label showing current holder, event, or team context.",
    formats: ["STANDARD"],
    defaultFormat: "STANDARD",
    symbolKinds: ["CODE128", "QR"],
  },
  TEMPORARY_OPERATIONAL: {
    key: "TEMPORARY_OPERATIONAL",
    label: "Temporary operational label",
    description: "Temporary field label when a scan-ready permanent identifier is not yet available.",
    formats: ["COMPACT", "STANDARD"],
    defaultFormat: "COMPACT",
    symbolKinds: ["QR"],
  },
};

export function labelForInventoryLabelTemplate(key: InventoryLabelTemplateKey): string {
  return INVENTORY_LABEL_TEMPLATES[key].label;
}

export function labelForInventoryLabelFormat(format: InventoryLabelFormat): string {
  const labels: Record<InventoryLabelFormat, string> = {
    COMPACT: "Compact",
    STANDARD: "Standard",
    WIDE: "Wide",
  };

  return labels[format];
}

export function resolveLabelFormatClasses(format: InventoryLabelFormat) {
  const classes: Record<
    InventoryLabelFormat,
    { wrapper: string; grid: string; symbol: string }
  > = {
    COMPACT: {
      wrapper: "max-w-xl",
      grid: "gap-4 lg:grid-cols-[minmax(0,1fr)_224px]",
      symbol: "h-40",
    },
    STANDARD: {
      wrapper: "max-w-4xl",
      grid: "gap-4 lg:grid-cols-[minmax(0,1fr)_260px]",
      symbol: "h-52",
    },
    WIDE: {
      wrapper: "max-w-5xl",
      grid: "gap-4 lg:grid-cols-[minmax(0,1fr)_320px]",
      symbol: "h-56",
    },
  };

  return classes[format];
}

export function buildOrganizationIdentifier(name: string, organizationId: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");
  const suffix = organizationId.slice(-4).toUpperCase();
  return `${initials || "ORG"}-${suffix}`;
}

export function buildDisplayReference(prefix: string, id: string) {
  return `${prefix}-${id.slice(-6).toUpperCase()}`;
}

export function buildStatusPresentation(input: {
  lifecycleStatus?: GearItemLifecycleStatus | null;
  readinessState?: InventoryReadinessState | null;
  conditionStatus?: GearConditionStatus | null;
  isActive?: boolean | null;
}): { label: string; tone: InventoryLabelStatusTone } {
  if (input.isActive === false) {
    return { label: "Inactive", tone: "inactive" };
  }

  if (input.readinessState) {
    const tone: InventoryLabelStatusTone =
      input.readinessState === "READY"
        ? "ready"
        : input.readinessState === "DECOMMISSIONED"
          ? "inactive"
          : "attention";
    return {
      label: `Readiness · ${labelForReadinessState(input.readinessState)}`,
      tone,
    };
  }

  if (input.lifecycleStatus) {
    const tone: InventoryLabelStatusTone =
      input.lifecycleStatus === "ACTIVE"
        ? "ready"
        : ["MAINTENANCE", "QUARANTINED", "LOST"].includes(input.lifecycleStatus)
          ? "attention"
          : ["RETIRED"].includes(input.lifecycleStatus)
            ? "inactive"
            : "neutral";

    return {
      label: `Lifecycle · ${formatGearOpsEnum(input.lifecycleStatus)}`,
      tone,
    };
  }

  if (input.conditionStatus) {
    const tone: InventoryLabelStatusTone =
      input.conditionStatus === "NEW" || input.conditionStatus === "GOOD"
        ? "ready"
        : input.conditionStatus === "FAIR"
          ? "neutral"
          : "attention";
    return {
      label: `Condition · ${formatGearOpsEnum(input.conditionStatus)}`,
      tone,
    };
  }

  return { label: "Operational reference", tone: "neutral" };
}

export function buildLabelFileName(input: {
  templateKey: InventoryLabelTemplateKey;
  subjectName: string;
  subjectId: string;
}) {
  const slug = input.subjectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${input.templateKey.toLowerCase()}-${slug || input.subjectId.slice(-6).toLowerCase()}.html`;
}

export function isConsumableTemplateAllowed(inventoryType: GearInventoryType) {
  return inventoryType === "CONSUMABLE";
}
