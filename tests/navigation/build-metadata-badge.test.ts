import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveBuildMetadataLabel } from "../../components/build-metadata-badge";

const packageJson = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { version?: string };
const packageVersionValue = packageJson.version ?? "0.0.0";
const packageVersion = packageVersionValue.startsWith("v") ? packageVersionValue : `v${packageVersionValue}`;

test("resolveBuildMetadataLabel uses preferred production format and shortens sha", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_APP_VERSION: "1.2.3",
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_GIT_SHA: "abcdef1234567890",
    NEXT_PUBLIC_BUILD_TIME: "2026-05-28T00:00:00Z",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "main",
  });

  assert.equal(label, "Prod:main v1.2.3 · abcdef1");
});

test("resolveBuildMetadataLabel falls back to package version on production", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_VERCEL_ENV: "production",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "main",
  });

  assert.equal(label, `Prod:main ${packageVersion} · 1234567`);
});

test("resolveBuildMetadataLabel keeps preview builds readable", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_VERCEL_ENV: "preview",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "feature/nav-fixes",
  });

  assert.equal(label, "Preview:feature/nav-fixes · 1234567");
});

test("resolveBuildMetadataLabel keeps local build fallback readable", () => {
  const label = resolveBuildMetadataLabel({});

  assert.equal(label, "CadreOS dev · local build");
});
