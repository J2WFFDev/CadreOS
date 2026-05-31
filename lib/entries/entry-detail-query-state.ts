export function readFirstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function shouldShowQuickCaptureSuccessBanner(quickCaptured: string | undefined): boolean {
  return quickCaptured === "1";
}
