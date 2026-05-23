type FacilityAddress = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

export function formatFieldOpsEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatFieldOpsDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatFacilityAddress(address: FacilityAddress) {
  const street = [address.addressLine1, address.addressLine2].filter(Boolean).join(", ");
  const locality = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const formattedAddress = [street, locality].filter(Boolean).join(" · ");

  return formattedAddress || "—";
}
