import packageJson from "../package.json";

const APP_NAME = "CadreOS";

function normalize(value: string | undefined) {
  return value?.trim() || "";
}

function normalizeSha(value: string | undefined) {
  if (!value) return "";
  return value.trim().slice(0, 7);
}

function normalizeVersion(value: string | undefined) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized.startsWith("v") ? normalized : `v${normalized}`;
}

function formatEnvironmentLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "production") return "Prod";
  if (normalized === "preview") return "Preview";
  if (normalized === "development" || normalized === "dev" || normalized === "local") return "Dev";
  if (!normalized) return "Dev";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function pickFirst(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) return normalized;
  }
  return "";
}

type BuildMetadataEnv = Record<string, string | undefined>;

export function resolveBuildMetadataLabel(env: BuildMetadataEnv = process.env) {
  const appEnv = pickFirst(env.NEXT_PUBLIC_APP_ENV, env.NEXT_PUBLIC_VERCEL_ENV) || "dev";
  const appEnvNormalized = appEnv.toLowerCase();
  const commitRef = normalize(env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF);
  const appVersion = normalizeVersion(
    pickFirst(env.NEXT_PUBLIC_APP_VERSION, appEnvNormalized === "production" ? packageJson.version : undefined),
  );
  const gitSha = normalizeSha(pickFirst(env.NEXT_PUBLIC_GIT_SHA, env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA));
  const buildTime = normalize(env.NEXT_PUBLIC_BUILD_TIME);
  const scope = commitRef || (appEnvNormalized === "production" ? "main" : "");
  const releaseContext = scope ? `${formatEnvironmentLabel(appEnv)}:${scope}` : "";
  const primary = [releaseContext, appVersion].filter(Boolean).join(" ").trim();
  const detail = gitSha || buildTime;

  if (primary && detail) return `${primary} · ${detail}`;
  if (primary) return primary;
  return `${APP_NAME} dev · local build`;
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
