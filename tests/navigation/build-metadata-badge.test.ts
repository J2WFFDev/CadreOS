import { strict as assert } from "node:assert";
import test from "node:test";

import { resolveBuildMetadataLabel } from "../../lib/build-info";

test("resolveBuildMetadataLabel uses preferred production format and shortens sha", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_RELEASE_ARC: "21D",
    NEXT_PUBLIC_BUILD_ITERATION: "21D.3",
    NEXT_PUBLIC_GIT_SHA: "abcdef1234567890",
    NEXT_PUBLIC_NAV_VERSION: "2",
  });

  assert.equal(label, "CadreOS Prod · Arc 21D · Build 21D.3 · abcdef1 · Nav v2");
});

test("resolveBuildMetadataLabel uses Vercel fallbacks when app values are missing", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_VERCEL_ENV: "preview",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "arc-22b",
  });

  assert.equal(label, "CadreOS Preview · Arc arc-22b · 1234567");
});

test("resolveBuildMetadataLabel does not force local fallback if metadata exists", () => {
  const label = resolveBuildMetadataLabel({
    NEXT_PUBLIC_NAV_VERSION: "v2",
  });

  assert.equal(label, "CadreOS Dev · Nav v2");
});

test("resolveBuildMetadataLabel keeps local build fallback readable", () => {
  const label = resolveBuildMetadataLabel({});

  assert.equal(label, "CadreOS dev · local build");
});
