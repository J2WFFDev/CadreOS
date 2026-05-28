const APP_NAME = "CadreOS";

function normalizeEnv(value: string | undefined) {
  return value?.trim() || "dev";
}

function normalizeSha(value: string | undefined) {
  if (!value) return "";
  return value.trim().slice(0, 7);
}

function normalizeBuildTime(value: string | undefined) {
  if (!value) return "";
  return value.trim();
}

export function BuildMetadataBadge() {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "";
  const appEnv = normalizeEnv(process.env.NEXT_PUBLIC_APP_ENV);
  const gitSha = normalizeSha(process.env.NEXT_PUBLIC_GIT_SHA);
  const buildTime = normalizeBuildTime(process.env.NEXT_PUBLIC_BUILD_TIME);

  const primary = appVersion ? `${APP_NAME} ${appVersion}` : `${APP_NAME} ${appEnv}`;
  const detailParts = [appVersion ? appEnv : "", gitSha, buildTime].filter(Boolean);
  const details = detailParts.length > 0 ? detailParts.join(" · ") : "unknown build";
  const label = `${primary} · ${details}`;

  return (
    <span
      className="inline-flex max-w-[30rem] items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      title={label}
      aria-label={`Build metadata: ${label}`}
    >
      {label}
    </span>
  );
}
