import { strict as assert } from "node:assert";
import test from "node:test";

import { resolveBuildMetadataLabel } from "../../components/build-metadata-badge";

test("resolveBuildMetadataLabel uses explicit app metadata and shortens sha", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_APP_VERSION: "1.2.3",
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_GIT_SHA: "abcdef1234567890",
    NEXT_PUBLIC_BUILD_TIME: "2026-05-28T00:00:00Z",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "main",
  });

  assert.equal(label, "CadreOS 1.2.3 · production · main · abcdef1 · 2026-05-28T00:00:00Z");
});

test("resolveBuildMetadataLabel falls back to Vercel metadata", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_VERCEL_ENV: "preview",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "feature/nav-fixes",
  });

  assert.equal(label, "CadreOS preview · feature/nav-fixes · 1234567");
});

test("resolveBuildMetadataLabel keeps local build fallback readable", () => {
  const label = resolveBuildMetadataLabel({});

  assert.equal(label, "CadreOS dev · local build");
});
