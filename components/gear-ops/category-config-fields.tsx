import {
  GearCategoryBehaviorType,
  GearCustodyMode,
  GearIdentifierType,
  GearMaintenanceFrequency,
  GearReportGroup,
} from "@prisma/client";

import {
  formatGearCategoryBehavior,
  formatGearCustodyMode,
  formatGearIdentifierType,
  formatGearReportGroup,
} from "@/lib/gear-category-config";
import { formatGearOpsEnum } from "@/lib/gear-ops";

export type GearCategoryConfigFieldValues = {
  behaviorType: GearCategoryBehaviorType;
  custodyMode: GearCustodyMode;
  primaryIdentifierType: GearIdentifierType;
  reportGroup: GearReportGroup;
  reportLabel: string;
  requiresReturnInspection: boolean;
  requiresMaintenanceTracking: boolean;
  maintenanceFrequency: GearMaintenanceFrequency | "";
  maintenanceIntervalDays: string;
  supportsConsumableTracking: boolean;
  consumableLowStockDefault: string;
  supportsEventDeployment: boolean;
  isKitContainer: boolean;
  guardianApprovalRequired: boolean;
  templateSlug: string;
};

export type GearCategoryConfigFieldErrors = Partial<
  Record<
    | "behaviorType"
    | "custodyMode"
    | "primaryIdentifierType"
    | "reportGroup"
    | "reportLabel"
    | "requiresReturnInspection"
    | "requiresMaintenanceTracking"
    | "maintenanceFrequency"
    | "maintenanceIntervalDays"
    | "supportsConsumableTracking"
    | "consumableLowStockDefault"
    | "supportsEventDeployment"
    | "isKitContainer"
    | "guardianApprovalRequired"
    | "templateSlug",
    string
  >
>;

function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
  error,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  error?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      {/* Hidden input preserves a "false" value when the checkbox is left unchecked. */}
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-1" />
      <span className="space-y-1">
        <span className="block font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        <span className="block text-zinc-600 dark:text-zinc-400">{description}</span>
        {error ? <span className="block text-red-600">{error}</span> : null}
      </span>
    </label>
  );
}

export function GearCategoryConfigFields({
  values,
  errors = {},
}: {
  values: GearCategoryConfigFieldValues;
  errors?: GearCategoryConfigFieldErrors;
}) {
  return (
    <div className="space-y-4">
      <input type="hidden" name="templateSlug" value={values.templateSlug} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="behaviorType" className="text-sm font-medium">
            Behavior type
          </label>
          <select
            id="behaviorType"
            name="behaviorType"
            defaultValue={values.behaviorType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearCategoryBehaviorType).map((behaviorType) => (
              <option key={behaviorType} value={behaviorType}>
                {formatGearCategoryBehavior(behaviorType)}
              </option>
            ))}
          </select>
          {errors.behaviorType ? <p className="text-sm text-red-600">{errors.behaviorType}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="custodyMode" className="text-sm font-medium">
            Custody mode
          </label>
          <select
            id="custodyMode"
            name="custodyMode"
            defaultValue={values.custodyMode}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearCustodyMode).map((mode) => (
              <option key={mode} value={mode}>
                {formatGearCustodyMode(mode)}
              </option>
            ))}
          </select>
          {errors.custodyMode ? <p className="text-sm text-red-600">{errors.custodyMode}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="primaryIdentifierType" className="text-sm font-medium">
            Primary identifier type
          </label>
          <select
            id="primaryIdentifierType"
            name="primaryIdentifierType"
            defaultValue={values.primaryIdentifierType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearIdentifierType).map((identifierType) => (
              <option key={identifierType} value={identifierType}>
                {formatGearIdentifierType(identifierType)}
              </option>
            ))}
          </select>
          {errors.primaryIdentifierType ? <p className="text-sm text-red-600">{errors.primaryIdentifierType}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="reportGroup" className="text-sm font-medium">
            Report group
          </label>
          <select
            id="reportGroup"
            name="reportGroup"
            defaultValue={values.reportGroup}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearReportGroup).map((group) => (
              <option key={group} value={group}>
                {formatGearReportGroup(group)}
              </option>
            ))}
          </select>
          {errors.reportGroup ? <p className="text-sm text-red-600">{errors.reportGroup}</p> : null}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="reportLabel" className="text-sm font-medium">
          Report label (optional)
        </label>
        <input
          id="reportLabel"
          name="reportLabel"
          defaultValue={values.reportLabel}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        {errors.reportLabel ? <p className="text-sm text-red-600">{errors.reportLabel}</p> : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Behavior flags</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <CheckboxField
            name="requiresReturnInspection"
            label="Require return inspection"
            description="Flag items in this category for inspection on return or recovery."
            defaultChecked={values.requiresReturnInspection}
            error={errors.requiresReturnInspection}
          />
          <CheckboxField
            name="supportsEventDeployment"
            label="Supports event deployment"
            description="Allow this category to be staged, deployed, and recovered for event workflows."
            defaultChecked={values.supportsEventDeployment}
            error={errors.supportsEventDeployment}
          />
          <CheckboxField
            name="isKitContainer"
            label="Acts as a kit container"
            description="Use this category for parent kit bundles or grouped asset containers."
            defaultChecked={values.isKitContainer}
            error={errors.isKitContainer}
          />
          <CheckboxField
            name="guardianApprovalRequired"
            label="Guardian approval required"
            description="Use when minors or protected roles need guardian approval before gear custody."
            defaultChecked={values.guardianApprovalRequired}
            error={errors.guardianApprovalRequired}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Maintenance</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxField
            name="requiresMaintenanceTracking"
            label="Track maintenance"
            description="Use maintenance logs and recurring inspection settings for this category."
            defaultChecked={values.requiresMaintenanceTracking}
            error={errors.requiresMaintenanceTracking}
          />
          <div className="space-y-1">
            <label htmlFor="maintenanceFrequency" className="text-sm font-medium">
              Maintenance frequency (optional)
            </label>
            <select
              id="maintenanceFrequency"
              name="maintenanceFrequency"
              defaultValue={values.maintenanceFrequency}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No default cadence</option>
              {Object.values(GearMaintenanceFrequency).map((frequency) => (
                <option key={frequency} value={frequency}>
                  {formatGearOpsEnum(frequency)}
                </option>
              ))}
            </select>
            {errors.maintenanceFrequency ? <p className="text-sm text-red-600">{errors.maintenanceFrequency}</p> : null}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="maintenanceIntervalDays" className="text-sm font-medium">
              Maintenance interval days (optional)
            </label>
            <input
              id="maintenanceIntervalDays"
              name="maintenanceIntervalDays"
              type="number"
              min="1"
              max="3650"
              defaultValue={values.maintenanceIntervalDays}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {errors.maintenanceIntervalDays ? <p className="text-sm text-red-600">{errors.maintenanceIntervalDays}</p> : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Consumable settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxField
            name="supportsConsumableTracking"
            label="Track consumable stock"
            description="Enable stock minimums and consumption workflows for this category."
            defaultChecked={values.supportsConsumableTracking}
            error={errors.supportsConsumableTracking}
          />
          <div className="space-y-1">
            <label htmlFor="consumableLowStockDefault" className="text-sm font-medium">
              Default low-stock threshold (optional)
            </label>
            <input
              id="consumableLowStockDefault"
              name="consumableLowStockDefault"
              type="number"
              min="0"
              max="999999"
              defaultValue={values.consumableLowStockDefault}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {errors.consumableLowStockDefault ? (
              <p className="text-sm text-red-600">{errors.consumableLowStockDefault}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
