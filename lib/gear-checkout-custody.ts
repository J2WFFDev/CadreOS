export function canEditGearCheckoutCustodyPeople(input: { isOrganizationAdmin: boolean }): boolean {
  return input.isOrganizationAdmin;
}

export function applyGearCheckoutCreateCustodyRestrictions(input: {
  canEditCustodyPeople: boolean;
  actorPersonId: string | null;
  issuedById: string;
  receivedById: string;
}) {
  if (input.canEditCustodyPeople) {
    return {
      issuedById: input.issuedById,
      receivedById: input.receivedById,
    };
  }

  return {
    issuedById: input.actorPersonId ?? "",
    receivedById: "",
  };
}

export function applyGearCheckoutUpdateCustodyRestrictions(input: {
  canEditCustodyPeople: boolean;
  issuedById: string;
  receivedById: string;
  existingIssuedById: string;
  existingReceivedById: string | null;
}) {
  if (input.canEditCustodyPeople) {
    return {
      issuedById: input.issuedById,
      receivedById: input.receivedById,
    };
  }

  return {
    issuedById: input.existingIssuedById,
    receivedById: input.existingReceivedById ?? "",
  };
}

export function buildGearCheckoutCustodyChangeSummary(input: {
  previous: {
    checkedOutById: string;
    issuedById: string;
    receivedById: string | null;
  };
  next: {
    checkedOutById: string;
    issuedById: string;
    receivedById: string | null;
  };
}): string | null {
  const changes: string[] = [];

  if (input.previous.checkedOutById !== input.next.checkedOutById) {
    changes.push(`checkedOutById ${input.previous.checkedOutById} → ${input.next.checkedOutById}`);
  }

  if (input.previous.issuedById !== input.next.issuedById) {
    changes.push(`issuedById ${input.previous.issuedById} → ${input.next.issuedById}`);
  }

  const previousReceivedById = input.previous.receivedById ?? "none";
  const nextReceivedById = input.next.receivedById ?? "none";
  if (previousReceivedById !== nextReceivedById) {
    changes.push(`receivedById ${previousReceivedById} → ${nextReceivedById}`);
  }

  if (changes.length === 0) {
    return null;
  }

  return `Checkout custody details updated (${changes.join("; ")}).`;
}
