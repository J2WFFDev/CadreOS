# Arc 24D.8X-O — Fix Inbox And Lists Owner Visibility

## Summary

This slice fixes owner visibility for Inbox and Lists after Entry owner/self-edit work. Inbox and Lists had still been using staff-oriented Entry access, so Athlete, Guardian, and limited/self-service users could create and open their own Entries but could not reliably see those Entries in Inbox or use personal Lists.

## Root Cause

Inbox and Lists were gated by `resolveEntryAccess`, which returns staff-oriented access levels. That blocked self-service actors before owner-based EntryOps visibility and personal list ownership could apply.

The list helper also returned program/team lists broadly. That was too permissive for this slice because shared Program/Team/Admin-function list hierarchy has not been designed yet.

## What Changed

- Inbox now uses EntryOps visibility for read access and Entry filtering.
- Inbox routing items are filtered to the current actor's visible person IDs unless the actor has organization-wide visibility.
- Lists now use a centralized EntryList visibility helper instead of staff Entry access.
- Personal list owners can view, create, and edit their own personal Lists.
- Unlinked actors are denied list access.
- Org Admin keeps broad non-archived list visibility.
- List detail now filters contained Entries through EntryOps visibility.
- List creation only exposes Personal scope to self-service users; shared Organization/Program/Team list creation remains restricted to Org Admin capability in this helper.
- List update checks list visibility and owner/admin edit capability before saving.

## Changed Routes And Helpers

- `/entries/inbox`
- `/lists`
- `/lists/create`
- `/lists/actions/create`
- `/lists/[listId]`
- `/lists/[listId]/update`
- `/lists/[listId]/actions/update`
- `lib/entries/lists.ts`

## Behavior Fixed

- Athlete-created Quick Capture Entries can appear in that Athlete's Inbox.
- Guardian/limited users can see their own Inbox items.
- Athlete/Guardian/limited users with a linked person can create and use personal Lists.
- Users cannot see another person's private personal Lists through list index/detail routes.
- List detail no longer shows Entries that are not visible through EntryOps visibility.
- Org Admin retains broad list visibility where currently supported.

## Deferred

- Program, Team, and Admin-function shared list hierarchy remains deferred.
- Scoped Program Director / Coach list visibility remains deferred until the shared list policy is explicit.
- Existing legacy entries without list assignments are not migrated here.
- Inbox routing cleanup for stale/unavailable routing rows remains deferred; invisible/unavailable rows are filtered from display.

## Validation

- `npx tsx --test tests/entry-lists/default-inbox.test.ts tests/entries/inbox-routing.test.ts`
- `npm run typecheck`
- `npm run build`

## Recommended Next Slice

24D.8X-P — Define shared List hierarchy and scoped list visibility.

Goal: decide how Organization, Program, Team, and admin-function Lists should be created, viewed, edited, and used by Org Admin, Program Director, Coach, Athlete, Guardian, and limited roles without exposing unrelated private Lists.
