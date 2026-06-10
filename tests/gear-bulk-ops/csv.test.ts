import test from "node:test";
import assert from "node:assert/strict";

import { buildGearImportTemplateCsv, parseGearImportCsv } from "@/lib/gear-bulk-ops";

test("buildGearImportTemplateCsv emits expected required headers", () => {
  const csv = buildGearImportTemplateCsv();
  const [header] = csv.trim().split("\n");

  assert.equal(
    header,
    "item_name,category,template_key,description,serial_number,asset_tag,asset_id,qr_identifier,owner_source,location,readiness_status,condition,quantity,low_threshold,notes,active",
  );
});

test("buildGearImportTemplateCsv keeps sample rows aligned with the template headers", () => {
  const rows = buildGearImportTemplateCsv().trim().split("\n");
  const headerCount = rows[0].split(",").length;

  for (const row of rows.slice(1)) {
    assert.equal(row.split(",").length, headerCount);
  }
});

test("parseGearImportCsv handles quoted values and aliases", () => {
  const csv = [
    "name,category,serial,asset_tag,quantity,active",
    '"Helmet, Red",Head Protection,SN-1,AST-1,1,true',
  ].join("\n");

  const parsed = parseGearImportCsv(csv);

  assert.equal(parsed.issues.length, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].values.item_name, "Helmet, Red");
  assert.equal(parsed.rows[0].values.serial_number, "SN-1");
  assert.equal(parsed.rows[0].values.asset_tag, "AST-1");
});

test("parseGearImportCsv reports unsupported headers as warnings", () => {
  const csv = ["item_name,category,unexpected_column", "Practice cone,General,extra"].join("\n");
  const parsed = parseGearImportCsv(csv);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0].message, /Unsupported header/i);
});

test("parseGearImportCsv rejects empty payload", () => {
  const parsed = parseGearImportCsv("\n\n");

  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.issues.length, 1);
  assert.match(parsed.issues[0].message, /empty/i);
});
