const APP_NAME = "CadreOS";

function normalize(value: string | undefined) {
  return value?.trim() || "";
}

function normalizeSha(value: string | undefined) {
  if (!value) return "";
  return value.trim().slice(0, 7);
}

function pickFirst(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) return normalized;
  }
  return "";
}

export function resolveBuildMetadataLabel(env: NodeJS.ProcessEnv = process.env) {
  const appVersion = normalize(env.NEXT_PUBLIC_APP_VERSION);
  const appEnv = pickFirst(env.NEXT_PUBLIC_APP_ENV, env.NEXT_PUBLIC_VERCEL_ENV) || "dev";
  const gitSha = normalizeSha(pickFirst(env.NEXT_PUBLIC_GIT_SHA, env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA));
  const buildTime = normalize(env.NEXT_PUBLIC_BUILD_TIME);
  const commitRef = normalize(env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF);

  const primary = appVersion ? `${APP_NAME} ${appVersion}` : `${APP_NAME} ${appEnv}`;
  const detailParts = [appVersion ? appEnv : "", commitRef, gitSha, buildTime].filter(Boolean);
  const details = detailParts.length > 0 ? detailParts.join(" · ") : "local build";

  return `${primary} · ${details}`;
}

export function BuildMetadataBadge() {
  const label = resolveBuildMetadataLabel();

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
