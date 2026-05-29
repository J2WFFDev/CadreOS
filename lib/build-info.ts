const APP_NAME = "CadreOS";

export type BuildInfoEnv = Record<string, string | undefined>;

function normalize(value: string | undefined) {
  return value?.trim() || "";
}

function pickFirst(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeEnvironment(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "production" || normalized === "prod") return "Prod";
  if (normalized === "preview") return "Preview";
  if (normalized === "development" || normalized === "dev" || normalized === "local") return "Dev";
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeSha(value: string) {
  const normalized = normalize(value);
  return normalized ? normalized.slice(0, 7) : "";
}

function normalizeVersion(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized.toLowerCase().startsWith("v") ? normalized : `v${normalized}`;
}

function formatReleaseArc(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized.toLowerCase().startsWith("arc ") ? normalized : `Arc ${normalized}`;
}

function formatBuildIteration(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized.toLowerCase().startsWith("build ") ? normalized : `Build ${normalized}`;
}

function formatCommitRef(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return normalized.toLowerCase().startsWith("ref ") ? normalized : `Ref ${normalized}`;
}

function formatReleaseTag(value: string) {
  const normalized = normalize(value);
  if (!normalized) return "";
  const tag = normalized.toLowerCase().startsWith("v") ? normalized : `v${normalized}`;
  return `Tag ${tag}`;
}

function formatReleaseVersion(value: string) {
  const normalized = normalizeVersion(value);
  return normalized ? `Release ${normalized}` : "";
}

export function resolveBuildMetadataLabel(env: BuildInfoEnv = process.env) {
  const appEnv = pickFirst(env.NEXT_PUBLIC_APP_ENV, env.NEXT_PUBLIC_VERCEL_ENV, env.VERCEL_ENV);
  const releaseArc = pickFirst(env.NEXT_PUBLIC_RELEASE_ARC);
  const commitRef = pickFirst(
    env.NEXT_PUBLIC_RELEASE_REF,
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
    env.VERCEL_GIT_COMMIT_REF,
  );
  const buildIteration = pickFirst(env.NEXT_PUBLIC_BUILD_ITERATION);
  const gitSha = pickFirst(env.NEXT_PUBLIC_GIT_SHA, env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, env.VERCEL_GIT_COMMIT_SHA);
  const releaseTag = pickFirst(env.NEXT_PUBLIC_RELEASE_TAG, env.RELEASE_TAG);
  const releaseVersion = pickFirst(env.NEXT_PUBLIC_RELEASE_VERSION, env.RELEASE_VERSION);
  const navVersion = pickFirst(env.NEXT_PUBLIC_NAV_VERSION);

  const hasMetadata = Boolean(appEnv || releaseArc || commitRef || buildIteration || gitSha || releaseTag || releaseVersion || navVersion);
  if (!hasMetadata) return `${APP_NAME} dev · local build`;

  const environmentLabel = normalizeEnvironment(appEnv || "dev") || "Dev";
  const parts = [
    `${APP_NAME} ${environmentLabel}`,
    formatCommitRef(commitRef),
    normalizeSha(gitSha),
    formatReleaseTag(releaseTag),
    formatReleaseVersion(releaseVersion),
    formatReleaseArc(releaseArc),
    formatBuildIteration(buildIteration),
    navVersion ? `Nav ${normalizeVersion(navVersion)}` : "",
    // TODO: Add feature-state maturity + feature flags segment from release controls.
    // TODO: Add migration status segment from deployment readiness metadata.
    // TODO: Add schema version segment from database schema metadata.
    // TODO: Add API version segment from backend contract metadata.
  ].filter(Boolean);

  return parts.join(" · ");
}
