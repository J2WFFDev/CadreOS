# Arc 23F — Journal Version History Manual QA Checklist

Use this checklist to validate version snapshots, trust/audit metadata, and privacy boundaries for Arc 23F.

---

## Snapshot Creation

- [ ] Create journal draft (`/journals/create`) and verify initial version snapshot created
- [ ] Edit draft title/body/visibility and verify draft-update snapshot created
- [ ] Submit journal and verify submit snapshot created
- [ ] Archive journal and verify archive snapshot created
- [ ] Verify each snapshot stores actor (`capturedByPersonId`) and timestamp (`capturedAt`)
- [ ] Verify status transition metadata (`fromStatus` / `toStatus`) is populated correctly

---

## Version History Access

- [ ] Author can open `/journals/[entryId]` and see Version history panel
- [ ] Author can open `/journals/[entryId]/versions/[versionId]` and view snapshot body
- [ ] Admin/program director can view version history and snapshot detail
- [ ] Coach can read allowed journal detail but cannot read version history content
- [ ] Guardian can read allowed journal detail but cannot read version history content
- [ ] Unrelated guardian cannot read journal detail or version URLs

---

## Direct URL Blocking

- [ ] As unauthorized role, attempt direct access to `/journals/[entryId]/versions/[versionId]`
- [ ] Expected: blocked error state/redirect with no snapshot body leakage

---

## Feed/Activity Safety

- [ ] Journal edit activity label remains safe summary only
- [ ] Journal submit activity label remains safe summary only
- [ ] Journal archive activity label remains safe summary only
- [ ] Verify `EntryActivity.metadataJson` does not include journal body, prior body, or diff content
- [ ] Verify broad feed surfaces do not expose journal version counts or snapshot text

---

## Regression

- [ ] Journal create/edit/submit/archive workflows still function
- [ ] Prompt response journal flows still function
- [ ] Guardian/coach relationship visibility checks still function
- [ ] Existing feed/dashboard pages render without journal body leakage
- [ ] Run `npm run test` and confirm only pre-existing known failure remains (gear import csv headers)

