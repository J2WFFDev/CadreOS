export function resolveSafeReturnPath(
  rawReturnTo: string | null | undefined,
  fallbackPath: string,
): string {
  if (!rawReturnTo) {
    return fallbackPath;
  }

  const trimmed = rawReturnTo.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallbackPath;
  }

  return trimmed;
}

export function appendReturnToParam(
  href: string,
  returnTo: string | null | undefined,
): string {
  const resolvedReturnTo = resolveSafeReturnPath(returnTo, "");

  if (!resolvedReturnTo) {
    return href;
  }

  const url = new URL(href, "https://cadreos.local");
  url.searchParams.set("returnTo", resolvedReturnTo);

  return `${url.pathname}${url.search}${url.hash}`;
}
