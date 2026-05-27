export const INVENTORY_LOCATION_NAME_MAX_LENGTH = 120;
export const INVENTORY_LOCATION_CODE_MAX_LENGTH = 20;
export const INVENTORY_LOCATION_DESCRIPTION_MAX_LENGTH = 500;

export type InventoryLocationFieldErrors = Partial<{
  name: string;
  locationCode: string;
  description: string;
}>;

export function validateInventoryLocationFields(input: {
  name: string;
  locationCode: string;
  description: string;
}): InventoryLocationFieldErrors {
  const errors: InventoryLocationFieldErrors = {};

  if (!input.name) {
    errors.name = "Location name is required.";
  } else if (input.name.length > INVENTORY_LOCATION_NAME_MAX_LENGTH) {
    errors.name = `Location name must be ${INVENTORY_LOCATION_NAME_MAX_LENGTH} characters or less.`;
  }

  if (input.locationCode.length > INVENTORY_LOCATION_CODE_MAX_LENGTH) {
    errors.locationCode = `Location code must be ${INVENTORY_LOCATION_CODE_MAX_LENGTH} characters or less.`;
  }

  if (input.description.length > INVENTORY_LOCATION_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${INVENTORY_LOCATION_DESCRIPTION_MAX_LENGTH} characters or less.`;
  }

  return errors;
}

