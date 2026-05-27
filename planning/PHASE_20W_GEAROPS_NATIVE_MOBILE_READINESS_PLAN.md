# Arc 20W — GearOps Native Mobile Readiness Plan

## Status

Planning and architecture-readiness documentation complete.  
This arc is documentation only.  
No native app, PWA rewrite, React Native/Expo/Capacitor project, app store asset, push notification system, offline sync implementation, new authentication stack, device registration system, native scanner integration, or unrelated module work is introduced in this arc.

## Arc Intent

Arc 20W defines what GearOps needs before it can support a future native mobile app or app-like mobile experience.

The goal is to prevent a divergent product, avoid duplicating business logic, and preserve the web-first CadreOS architecture.

This arc is a planning and architecture-readiness arc, not a native mobile implementation arc.

---

## 1) Native Mobile Readiness Objective

### Why native mobile may matter

GearOps is built for field operators who work in environments where mobile-first access is the default. The following scenarios represent real motivations for native mobile investment in a future product phase:

**Field use under weak connectivity**  
Event venues, equipment cages, storage vaults, and outdoor sport facilities often have degraded or absent cellular/Wi-Fi coverage. A native app can cache operational data locally and queue actions for later sync in ways that mobile web cannot always guarantee.

**Faster scan and camera workflows**  
Native apps can invoke device cameras directly without browser permission flows and with tighter integration to hardware scan SDKs, reducing friction for QR/barcode scan operations that are central to GearOps workflows.

**Event setup and recovery**  
Gear staging, loadout confirmation, and event gear plan verification are time-sensitive tasks. A native app with pre-cached event snapshots could accelerate these workflows before and during events.

**Equipment cage and vault operations**  
Cage and vault sweeps, bulk check-in/check-out, and condition logging are physical walkaround operations better supported by native device capabilities than by browser-based interfaces.

**Offline drafts and queued actions**  
Operators may need to record observations, flag issues, or queue custody transfers when connectivity is unavailable. Native offline storage and sync queue support is more reliable than browser-based equivalents.

**Push notification potential**  
Native apps can receive push notifications even when the app is not open. Gear issue alerts, overdue return reminders, and event gear readiness signals may benefit from push delivery in a future notification module.

**App-like operator experience**  
Native apps can provide faster launch times, gestures, and hardware integrations (vibration, audio feedback on scan) that improve the perceived speed and physical feel of field workflows.

**Future mobile deployment options**  
Internal app distribution through TestFlight or equivalent enterprise distribution channels allows pilot testing before public app store release.

### Why native mobile should not be rushed

The following risks justify treating native mobile as a future product decision rather than an immediate build arc:

**Sync complexity**  
Native offline storage requires a robust sync queue, conflict detection, and conflict review flow. Arc 20V defines this design but does not implement it. Native mobile without reliable sync creates data integrity risk.

**Conflict risk**  
Concurrent offline edits from multiple operators targeting the same gear item, custody record, or event gear plan can produce conflicting state without a server-confirmed resolution path. This is especially dangerous in custody and checkout/check-in flows.

**App store overhead**  
iOS App Store and Google Play Store require accounts, privacy policy disclosures, permissions descriptions, review cycles, and ongoing maintenance of app store listings and release notes.

**Duplicated UX risk**  
A native app that diverges from the web GearOps interface creates two separate UX surfaces to maintain. Feature additions must be applied to both, and operator training becomes more complex.

**Permission and security complexity**  
Native apps request device permissions (camera, local storage, notifications) that must be handled gracefully. Incorrect permission handling, insecure local storage, or poor session management can create security and privacy exposure.

**Support burden**  
Native apps introduce OS version compatibility, device fragmentation, app store review delays, and crash/log collection requirements that the current web-first stack does not have.

**Divergent web/native behavior risk**  
If native app logic diverges from web business rules, operators may encounter different validation outcomes, permission states, or workflow behaviors depending on which surface they use. This erodes trust in the system.

---

## 2) Mobile Web / PWA / Native Decision Framework

Three approaches are compared. Mobile web is the near-term default unless a future product decision explicitly authorizes a change.

### Option A — Mobile Web

**Description:** GearOps is accessed through a mobile browser. The existing responsive, mobile-first layout is the interface.

**Benefits:**
- single codebase with no divergence risk
- no app store accounts or review cycles
- consistent behavior with web users
- immediate deployment of all changes
- no device permission management overhead
- simplest operational support model

**Limitations:**
- browser-based camera/scan permission flows add friction
- offline storage is limited by browser storage quotas and policies
- background sync is not available in all mobile browsers
- push notifications are not supported on all platforms (iOS Safari historically limited)
- installed PWA support varies by browser and OS version
- no launcher icon or home screen presence without PWA install

**When appropriate:** Near-term default. All GearOps field workflows should be accessible and functional via mobile browser before any native investment is evaluated.

---

### Option B — Progressive Web App (PWA)

**Description:** GearOps is enhanced with service worker, web app manifest, and offline caching to provide an installable, app-like experience from the browser.

**Benefits:**
- no separate native codebase
- installable to home screen on supporting platforms
- service worker enables offline caching improvements
- reduced app store overhead (though app store submission is possible)
- shares web codebase

**Limitations:**
- platform support for PWA features is inconsistent (iOS Safari has historically lagged)
- push notification support on iOS remains limited without native wrapper
- offline capabilities are bounded by browser storage APIs
- camera/scan integration still subject to browser permission friction
- service worker complexity introduces new failure modes (stale cache, update conflicts)

**When appropriate:** Suitable as a near-term improvement if pilot feedback identifies specific pain points that PWA service worker caching would address (e.g., repeat-visit load time, basic offline resilience). Does not fully replace native for heavy scan/camera or push notification use cases.

---

### Option C — Native Mobile App

**Description:** A dedicated iOS and/or Android app is built and distributed through app stores or internal distribution channels.

**Benefits:**
- strongest device integration (camera, scan SDK, haptics, biometrics)
- reliable offline local storage with clear OS-managed quotas
- push notification path via APNs/FCM
- background sync awareness
- launcher integration and notification badge support
- fastest perceived startup time for native UI

**Risks and costs:**
- requires complete sync queue, conflict detection, and conflict review UX before it is safe to operate
- separate codebase (or shared logic layer) must be maintained
- app store accounts, review cycles, and compliance requirements
- OS version fragmentation and device compatibility testing
- security audit of local storage, session handling, and permission model required
- highest ongoing maintenance burden
- any divergence from server-side business rules creates correctness risk

**When appropriate:** Only after pilot feedback confirms mobile web/PWA are insufficient for core GearOps workflows. Only after offline sync, conflict detection, and auth/session models are stable and documented. Only after a product decision authorizes the investment.

---

### Decision rule summary

| Signal | Appropriate path |
|---|---|
| Mobile browser works acceptably | Stay on mobile web |
| Load time or basic offline caching is the problem | Consider PWA improvement |
| Scan, camera, push, or offline sync are blockers | Evaluate native |
| Product decision authorizes native investment | Begin native prerequisite verification |

---

## 3) Shared Architecture Principles

These principles apply regardless of which mobile surface is used. Native mobile must not violate any of them.

**One GearOps domain model**  
Gear items, categories, custody records, assignments, condition logs, event gear plans, reservations, holds, audit records, and consumable transactions are defined once. Native mobile reads and writes to the same domain objects as web.

**One source of truth on the server**  
The server database is authoritative. Local state on any device is a draft or pending state until the server confirms the result. No native client may treat local state as final.

**Shared API contracts**  
Native mobile must use the same API contracts as web GearOps. The API must not expose a separate native-only data model. API contract stability (see Section 12) is a prerequisite.

**Shared permission model**  
Role-based authorization is enforced server-side. Native mobile must not attempt to derive permissions locally or cache permission decisions beyond the current session. Permission revalidation must occur on reconnect.

**Shared organization scoping**  
All GearOps data is scoped to an organization context. Native mobile must present and operate within the same organization boundary as web. Multi-organization switching, if supported, must route through the same server-side context resolution.

**Shared offline action classification**  
The Arc 20V offline action classification (online-required, queue-safe, draft-safe) applies to native mobile as well as mobile web. High-risk actions remain online-required unless a future product decision explicitly changes the policy.

**Shared notification handoff model**  
GearOps identifies notification-worthy events and produces handoff payloads. A future communications module decides delivery. Native push notification integration must not create a separate GearOps notification engine; it must consume the same handoff model defined in Arc 20U.

**Shared terminology**  
Gear item names, status labels, workflow action names, and operational concepts must remain identical between mobile and web surfaces. Operators should not encounter different terminology on different devices.

**Shared activity and history trust model**  
Operational history (custody transfers, condition logs, audit results, assignment records) is only trusted once server-confirmed. Native mobile must not display locally-composed history as confirmed history.

**Native app must not create separate business rules**  
No validation logic, permission rule, or workflow constraint may exist only in the native app. Business rules live on the server.

**Native app must not bypass server confirmation**  
Any action that changes gear state, custody, assignment, or reservation must be confirmed by the server before the result is shown as final. This is non-negotiable for audit integrity.

---

## 4) Native Mobile Prerequisites

The following prerequisites must be satisfied before a native mobile build begins. Each represents a stability gate.

**Stable GearOps API contracts**  
API endpoints for item lookup, custody, assignment, event gear plans, reservations, holds, audit, and sync batch operations must be stable and documented. Unstable APIs would require native app updates with every server change.

**Stable auth and session model**  
The session lifecycle (login, token refresh, organization context, role assignment) must be stable and documented. Native apps handle token management differently from browsers and require explicit session contract guarantees.

**Stable organization context model**  
Organization scoping must be consistent and server-enforced. Native apps must not be able to access data outside the scoped organization.

**Stable permission and role model**  
Role-based authorization rules must be stable. The native app must handle permission revalidation on reconnect and on organization switch.

**Stable scan and identifier model**  
QR/barcode identifier formats, resolution logic, fallback paths, and error states must be stable and documented. Camera integration builds on this model.

**Stable offline action classification**  
The Arc 20V action classification (online-required vs queue-safe vs draft-safe) must be finalized before native offline storage is scoped or built.

**Stable sync queue design**  
The Arc 20V sync queue contract (pending action shape, batch submit format, conflict detection interface) must be finalized.

**Conflict detection and review model**  
A conflict detection policy and conflict review UX must be designed and agreed upon before native offline write actions are enabled. Allowing offline writes without conflict resolution creates unrecoverable data integrity risk.

**Notification delivery strategy**  
The future communications module strategy must be decided before native push notification integration is scoped. Push token registration and routing must integrate with the communications module, not bypass it.

**Mobile-safe error states**  
All GearOps workflows must have documented error states that are safe to display on a small screen without exposing sensitive operational data. Error messages must be actionable and not expose internal server state.

**Pilot feedback completed**  
At least one full pilot cycle (per Arc 20R) must be completed. Pilot feedback must confirm that mobile web/PWA is insufficient for identified workflows before native investment is justified.

**Operator workflows validated**  
Core GearOps operator workflows (scan-first checkout, check-in, event gear staging, cage sweep, audit) must be validated in the field on mobile web before native equivalents are built.

**Security and privacy review completed**  
A security and privacy review must assess local storage encryption expectations, device loss scenarios, session token handling, and organization data scope before native local storage is implemented.

**App support and maintenance owner identified**  
A designated owner for app store accounts, OS version compatibility, crash collection, and ongoing native app maintenance must be identified before the native build begins.

---

## 5) Device Capability Requirements

The following device capabilities are relevant to a future native GearOps app. They are separated into required and optional.

### Required for native parity with web workflows

| Capability | Requirement level | Notes |
|---|---|---|
| Camera scan (QR/barcode) | Required | Core to scan-first GearOps workflows; replaces browser-based scan entry |
| Offline local storage | Required | Must support snapshot cache and sync queue persistence |
| Network status detection | Required | Must show accurate online/offline state; must gate online-required actions |
| Secure local storage | Required | Organization-scoped data at rest must be encrypted; cleared on logout |
| Device and session identifier | Required | Needed for sync conflict attribution and stale session detection |

### Required for native advantage over mobile web

| Capability | Requirement level | Notes |
|---|---|---|
| Push notification support | Required for push path | Depends on APNs/FCM and future communications module decision |
| Background/foreground sync awareness | Required for sync | App must detect foreground transition and trigger pending sync |

### Optional or future consideration

| Capability | Requirement level | Notes |
|---|---|---|
| Local notifications | Optional | Useful for reminders when offline or in background; lower priority than push |
| Label/print handoff | Optional | Possible integration with label printer via Bluetooth or local network; deferred |
| File and photo attachment | Optional | Not currently in GearOps scope; would require storage and privacy design |
| Biometric authentication | Optional | Convenience lock for local session; not a substitute for server auth |
| Haptic feedback on scan | Optional | Quality-of-life improvement for scan confirmation; low-risk addition |

---

## 6) Offline / Sync Dependency

Native mobile readiness is directly dependent on Arc 20V offline sync design.

A native GearOps app without a working offline sync model would either be fully online-only (equivalent to mobile web) or would allow offline writes without a safe merge path. Neither outcome justifies native investment alone.

### Dependencies from Arc 20V

**Offline snapshot model**  
The bounded snapshot of gear items, identifiers, event gear plans, custody summaries, and recent activity must be defined, implemented, and tested before native offline storage can be scoped.

**Local cache rules**  
Which data is cached, how long it is retained, when it expires, and when it is refreshed must be defined and agreed upon.

**Sync queue**  
The pending action queue (action type, payload, timestamp, retry count, local status) must be designed and stabilized. The native app depends on this shape.

**Retry behavior**  
The retry policy for failed sync attempts (exponential backoff, max retries, error classification) must be defined.

**Conflict detection**  
The server must be able to detect that a native client submitted an action against a stale snapshot. Version tokens or timestamps must be part of the sync contract.

**Conflict review UI**  
An operator-facing conflict review surface must exist before offline write actions are allowed. Silently discarding or auto-resolving conflicts is not acceptable for custody or audit records.

**Permission revalidation**  
On reconnect after offline period, the native app must revalidate organization context, role, and permission state before executing queued actions.

**Server-confirmed history**  
Gear item history, custody logs, and audit records must only reflect server-confirmed results. Locally composed history must be visually distinguished as pending until confirmed.

**Privacy-safe local storage**  
Local snapshot data must be encrypted, organization-scoped, and cleared on logout. The privacy boundary for locally stored operational data must be documented.

**Online-required action boundaries**  
High-risk actions (consumable transactions, irreversible custody transfers, identity-sensitive assignments) remain online-required. This boundary must be enforced in the native app the same way as in mobile web.

---

## 7) Scan and Label Workflow Readiness

### Scan requirements for native mobile

**QR and asset tag scan**  
The native app must invoke the device camera or integrated scan SDK to read QR codes and barcode formats supported by Arc 20B/20D GearOps label design.

**Fallback manual lookup**  
When scan fails (poor lighting, damaged label, unsupported format), the operator must be able to enter an identifier manually. The manual path must resolve through the same lookup logic as a successful scan.

**Scan failure states**  
The native app must handle and display: unrecognized identifier, identifier not found in organization, stale cache miss (online required to resolve), camera permission denied, and scan timeout.

**Duplicate identifier handling**  
If a scanned identifier resolves to multiple items (data integrity issue), the native app must surface this conflict clearly and not silently pick one result.

**Missing label behavior**  
If a gear item has no label or the label is missing, the operator must be directed to the manual lookup or item creation flow as appropriate.

**Camera permission handling**  
The native app must request camera permission at the appropriate moment and handle denial gracefully without crashing or blocking the rest of the app. Fallback to manual entry must always be available.

**Offline cached identifier lookup**  
When offline, the native app must attempt to resolve a scanned identifier against the local snapshot cache. A cache miss when offline must be surfaced clearly, not silently failed.

**Online confirmation after scan where required**  
Scan alone does not complete a custody transfer, check-in, check-out, or assignment. Server confirmation must be required for all state-changing operations, even those initiated by scan.

**Label content safety**  
Scanned QR payloads must be treated as untrusted input. The native app must not execute arbitrary content found in a QR code. Only recognized GearOps identifier formats should be resolved.

---

## 8) Notification Readiness

Native mobile readiness for notifications is tied to Arc 20U notification handoff design.

Push notification integration must not be built before the following decisions are made.

### Future notification needs and dependencies

**Push notification provider decision**  
A push notification provider (APNs for iOS, FCM for Android, or a unified provider such as OneSignal, Courier, or custom relay) must be selected before push token registration can be designed. This decision belongs to a future communications module arc, not GearOps.

**Notification delivery module dependency**  
GearOps produces notification handoff payloads as defined in Arc 20U. A future communications module is responsible for delivery. The native app should receive push payloads through that module, not through a GearOps-specific side channel.

**User preference model**  
Notification preferences (which alert types to receive, which channels to use) belong to a future preference model. The native app must not implement its own preference storage that diverges from the server-side model.

**Guardian and parent communication rules**  
Push notifications that could reach guardians or parents are subject to role-based routing and privacy rules defined in Arc 20U. The native app must not bypass these rules.

**Role-based recipient rules**  
Notification routing is role-scoped. A push notification sent to a device for a user who has changed roles since the notification was generated must be handled gracefully (not displayed, or displayed with appropriate context).

**Notification payload safety**  
Push payloads must not include sensitive operational details in the notification body. The payload should carry a reference to the GearOps record, not the record contents.

**Urgent vs digest behavior**  
Urgent alerts (gear issue during active event) and digest summaries (end-of-day gear readiness) have different delivery urgency. The native app must respect the severity classification from the handoff model.

**Pending and offline action alerts**  
If an operator has queued offline actions that failed to sync, the native app should surface this via a local notification or in-app banner, not through the push delivery path.

**Event gear issue alerts**  
Gear readiness failures during active events are high-urgency notification candidates. Push delivery for these cases is a strong justification for native investment, but only after the communications module and delivery strategy are in place.

---

## 9) Authentication and Security Readiness

### Session handling

The native app must manage auth tokens explicitly. Unlike a browser where cookies can handle session state, a native app must store tokens securely (platform secure storage, not plain-text local storage) and attach them to every API request.

### Token refresh

The session token refresh lifecycle must be defined as part of the stable auth model prerequisite. The native app must handle token expiry gracefully: refresh silently when possible, prompt re-login when refresh fails.

### Organization switching

If a user has access to multiple organizations, switching organization context must route through the server-side context resolution and not be cached locally. Local data must be scoped per organization and must be cleared when context switches.

### Role and permission refresh

On reconnect after an offline period, the native app must re-fetch role and permission state from the server before executing queued actions. Stale role assumptions must not influence which actions are permitted.

### Local storage encryption expectations

Any organizational data stored locally (snapshot cache, sync queue, offline drafts) must be encrypted using platform-provided secure storage APIs. Encryption keys must not be derivable from the device UDID alone.

### Device loss considerations

If a device is lost or stolen, the operator or an admin must be able to revoke the session from the server. The local storage content must not be readable without authentication.

### Logout clears local data

Logout must trigger complete removal of locally cached GearOps data: snapshot cache, sync queue, offline drafts, session tokens, and organization context. This is a hard requirement.

### Stale permission handling

If a user's role is revoked or reduced while they have an active session on a native device, the next API call must receive an authorization error. The native app must handle this gracefully (clear session, prompt re-login) rather than crashing or silently continuing.

### Unauthorized offline data access prevention

Local data must not be accessible to other apps on the device. Platform sandboxing and secure storage APIs must be used. If the device does not support sandboxed storage for the target OS version, that OS version must not be supported.

### Audit trail preservation

Server-confirmed records remain authoritative. Locally stored data is operational aid only. The audit trail lives on the server, not on the device. If a device is wiped, no confirmed audit history is lost.

---

## 10) Mobile UX Readiness Standards

These standards apply to any mobile GearOps surface (web, PWA, or native) and must be met before a native app can credibly improve on the current experience.

**Large touch targets**  
Interactive elements (buttons, list items, scan triggers) must meet minimum touch target size standards (at least 44×44 points on iOS, 48×48dp on Android equivalent). Small targets are a critical failure for field workflows on gloved hands or under physical stress.

**One-handed operation where practical**  
Primary workflow actions (scan trigger, confirm, cancel, status toggle) must be reachable in the thumb zone for common device sizes. Two-handed interactions are acceptable for complex admin or review tasks.

**Fast scan-first flow**  
The scan entry point must be accessible from the home/dashboard screen in two taps or fewer. Scan result resolution must complete and present the item in under two seconds on a reasonable device.

**Clear primary action**  
Each screen must have one obvious primary action. Operators must not need to read multiple options to know what to do next.

**Minimal typing**  
Workflows must minimize keyboard entry. Scan resolves identifiers. Dropdowns and pickers replace free-text where possible. Notes and condition descriptions may require keyboard but should be optional or secondary.

**Clear pending, failed, and completed states**  
Every action must visually communicate its current state: locally drafted, pending sync, sync failed, server confirmed. Operators must never be left unsure whether an action was recorded.

**Offline and online banner**  
The app must display a persistent, unobtrusive indicator of connectivity state. When offline, the banner must also indicate whether the local snapshot is current enough to trust for lookups.

**Action confirmation for risky workflows**  
Destructive or high-impact actions (irreversible custody transfer, consumable deduction, hold release) must require explicit confirmation before submission. Confirmation dialogs must be brief and specific.

**Simple operator view first**  
The default mobile view for gear item detail, event gear plan, and scan result must be operator-optimized: status, custody, readiness, and primary actions. Admin-level detail (full audit log, config fields, schema metadata) must be behind an advanced or details expansion.

**Admin complexity behind advanced views**  
Configuration, reporting, bulk operations, and category/template management are admin tasks. They should not surface in the primary mobile flow unless an admin explicitly navigates to them.

**Readable event checklist**  
The event gear deployment checklist must be legible at arm's length on a mobile screen. Checkable items must have sufficient line height and contrast.

**Readable item detail**  
Gear item detail (name, type, status, custody, condition, location) must be legible without scrolling for the most commonly accessed fields. Critical alerts (maintenance due, hold active, condition flag) must be above the fold.

**Quick return and recovery flow**  
After completing a scan action, the operator must be returned to the scan entry point or previous context with minimal taps. The app must not leave operators stranded in a deep workflow page after a scan completion.

---

## 11) Native App Technical Options

The following paths represent future implementation options. No framework is selected or configured in this arc. Selection should follow pilot feedback and product decision.

### Option 1 — Keep mobile web only

**Benefits:** Zero maintenance overhead beyond the existing codebase. All GearOps improvements ship immediately to all devices.  
**Risks:** Camera, offline, and push notification limitations persist.  
**Complexity:** None.  
**Offline/sync dependency:** None beyond current Arc 20K bounded foundation.  
**Maintenance impact:** No additional burden.

### Option 2 — Improve PWA

**Benefits:** Installable experience, improved caching, potential offline resilience improvements without a separate codebase.  
**Risks:** iOS platform limitations may persist; service worker logic introduces new failure modes.  
**Complexity:** Low to medium. Requires service worker design, manifest, and caching strategy.  
**Offline/sync dependency:** Depends on Arc 20V snapshot model for meaningful offline improvement.  
**Maintenance impact:** Service worker must be maintained alongside application code.

### Option 3 — React Native wrapper / Expo

**Benefits:** Shared TypeScript/JavaScript ecosystem with web codebase. React Native UI components offer native rendering. Expo simplifies build/distribution.  
**Risks:** Two UI codebases to maintain (web and native). React Native upgrade cycles can introduce breaking changes. Some web-only libraries require native equivalents.  
**Complexity:** High. Requires separate project, component library decisions, and shared logic extraction.  
**Offline/sync dependency:** Full Arc 20V sync contract required. React Native offline storage (e.g., WatermelonDB, SQLite) must be evaluated.  
**Maintenance impact:** Ongoing native dependency maintenance, OS compatibility, and Expo SDK upgrades.

### Option 4 — Capacitor-style wrapper

**Benefits:** Wraps existing web GearOps app in a native shell. Provides access to native APIs (camera, push, storage) with minimal web code changes. Single codebase.  
**Risks:** Performance of web views on low-end devices may be inferior to native UI. Native API bridge is a dependency. Debugging across web and native layers is complex.  
**Complexity:** Medium. Requires Capacitor project setup, plugin integration, and build pipeline.  
**Offline/sync dependency:** Depends on Arc 20V for offline storage plugin design.  
**Maintenance impact:** Capacitor plugin updates and OS compatibility testing required.

### Option 5 — Fully native app

**Benefits:** Maximum device integration, best performance, strongest offline/sync and push options.  
**Risks:** Highest cost, two separate codebases, fullest divergence risk, requires dedicated iOS and/or Android developers.  
**Complexity:** Very high.  
**Offline/sync dependency:** Full Arc 20V contract required. Native SQLite or equivalent persistence layer required.  
**Maintenance impact:** Highest maintenance burden of all options.

### Option 6 — Hybrid shell around web views

**Benefits:** Retains full web UI, adds native shell for home screen presence, deep link handling, and basic push/notification support.  
**Risks:** Web view performance and browser engine differences. App store review may flag web view-only apps. Limited native UI benefit.  
**Complexity:** Low to medium. Requires WKWebView/WebView project and push/notification bridge.  
**Offline/sync dependency:** Depends on web PWA/service worker strategy.  
**Maintenance impact:** Shell must be updated alongside OS releases.

---

## 12) API / Backend Contract Readiness

The following API capabilities are needed to support native mobile GearOps. Items marked **design-level** are not yet implemented or are incomplete. Items marked **foundation exists** have partial support in the current web implementation.

| Capability | Status | Notes |
|---|---|---|
| Mobile login and session refresh | Design-level | Token-based session refresh contract must be defined for native clients |
| Organization context resolution | Foundation exists | `getOrganizationScope()` exists in web; must be accessible via API for native |
| Offline snapshot fetch | Design-level | Arc 20V defines shape; endpoint not yet implemented |
| Sync batch submit | Design-level | Arc 20V defines contract; endpoint not yet implemented |
| Sync result and conflict return | Design-level | Arc 20V defines conflict response shape; not yet implemented |
| Item lookup by identifier | Foundation exists | QR/barcode lookup via Arc 20B/20E; must be formalized as stable API |
| Event gear plan snapshot | Design-level | Event gear plan data accessible via web routes; native snapshot endpoint not defined |
| Reservation and hold lookup | Foundation exists | Reservation/hold state exists; mobile-optimized summary endpoint not defined |
| Pending action review | Design-level | Sync queue pending action review requires a defined API surface |
| Notification token registration | Future only | Not implemented; depends on communications module |
| Device and session registration | Future only | Not implemented; security review required before design |

All API contracts used by native mobile must be versioned or otherwise protected from breaking changes without a migration path.

---

## 13) App Store / Deployment Considerations

The following considerations apply to a future native app deployment. No app store accounts, native project files, or assets are created in this arc.

**App naming**  
The app name must be consistent with the CadreOS/GearOps brand. Internal naming (e.g., "GearOps" or "CadreOS Gear") must be decided before store submission.

**Bundle identifiers**  
iOS bundle identifier and Android application ID must be reserved before development begins (e.g., `com.cadreos.gearops`).

**App store accounts**  
Apple Developer Program and Google Play Developer accounts must be established and owned by the appropriate organization entity before submission.

**Mobile privacy disclosures**  
App store privacy disclosures must accurately reflect: data collected (organization context, gear operational records), data not collected (payment, health), and data shared (none, beyond organization scope).

**Permissions disclosures**  
Camera, local storage, and notification permission usage descriptions must be written in plain language and submitted with the app.

**Support process**  
A support contact, feedback channel, and issue resolution path must be defined before public or internal release.

**Release cadence**  
Native apps require app store review for each release (typically 1–3 business days for iOS). Release cadence must account for this latency, especially for security fixes.

**Crash and log collection strategy**  
A crash reporting tool (e.g., Sentry, Firebase Crashlytics) must be selected and integrated before public release. Crash reports must not include personally identifiable information or sensitive operational data.

**Mobile version compatibility**  
Minimum OS version targets (iOS 16+, Android 11+ as a starting point) must be chosen based on target device demographics and evaluated against feature requirements.

**Phased rollout**  
Internal testing should precede any public release. TestFlight (iOS) and internal testing track (Google Play) must be used to validate with real operators before broad rollout.

**Test users and internal testing**  
A pool of internal test users representing field operators, admins, and coaches must be identified for pre-release validation.

---

## 14) Pilot Feedback Needed Before Native Decision

The following evidence must be gathered from at least one full pilot cycle (Arc 20R) before native mobile investment is justified:

**How often operators use mobile**  
What percentage of GearOps sessions are on mobile devices? Is mobile the primary access point for field operators?

**How often scan is used**  
Are operators consistently using scan workflows (QR, barcode) or defaulting to manual lookup? If scan is rarely used, the primary native advantage is reduced.

**Where mobile web fails**  
Are there specific workflows where mobile web breaks down (slow load, layout issues, browser permission friction, camera access problems)? These failures must be documented specifically.

**Where offline matters**  
Which venues or workflows encounter connectivity problems? Is offline access a blocker or merely an inconvenience?

**What actions users attempt offline**  
Which GearOps actions do operators attempt when offline? This defines the minimum offline write scope for any future sync implementation.

**Which workflows are too slow**  
Which specific task sequences are unacceptably slow on mobile? Load times, navigation depth, and form submission latency must be measured.

**Which labels and identifiers fail**  
Are there scan failures related to label durability, print quality, or identifier format? These failures may require label/print process improvements rather than native app investment.

**Whether push notifications are necessary**  
Do operators miss critical alerts because they are not in the app? Would push notifications change operational outcomes?

**Whether PWA is enough**  
After PWA hardening (installable, service worker caching, offline-safe read views), are remaining pain points justified by the native app cost?

**Whether native app cost is justified**  
Given the pilot evidence, does the operational improvement from native features (camera, offline, push) outweigh the development, maintenance, and support costs?

---

## 15) Future Implementation Sequencing

The following staged path is proposed. Phases after Arc 20W are future arcs and are not committed or scheduled.

| Phase | Focus | Dependency |
|---|---|---|
| **Arc 20W** (this arc) | Native mobile readiness plan and documentation | Completed |
| Future — mobile web/PWA hardening | Improve mobile web performance, offline-safe read views, PWA install, service worker caching | Pilot feedback from Arc 20R |
| Future — offline snapshot implementation | Implement Arc 20V snapshot endpoint and local cache model | Arc 20V design complete |
| Future — limited offline queued actions | Implement queue-safe action set for mobile offline writes | Snapshot implementation complete |
| Future — conflict review UX | Build conflict detection and operator-facing review UI | Queued action model stable |
| Future — notification delivery module | Build communications module; connect Arc 20U handoff to delivery | Product decision on notification strategy |
| Future — native technical spike | Evaluate Capacitor or React Native wrapper against pilot evidence | Pilot evidence collected; prerequisites verified |
| Future — native pilot app | Build limited native pilot app for internal test operators | Technical spike complete; prerequisites satisfied |
| Future — app store/internal distribution | Submit to TestFlight / Play internal testing; evaluate public release | Native pilot app validated |

---

## 16) Non-Goals

The following are explicitly out of scope for Arc 20W and must not be introduced in this arc:

- no native mobile app implementation
- no React Native, Expo, or Capacitor project setup or configuration
- no app store accounts, app store assets, or app store submissions
- no full offline sync implementation (Arc 20V design only)
- no push notification delivery engine (Arc 20U handoff design only)
- no new authentication system or auth stack changes
- no device management system or device registration schema
- no mobile-only business logic that diverges from web GearOps domain rules
- no duplication of GearOps domain model for a native data layer
- no unrelated CadreOS module mobile redesign
- no camera SDK integration or native scan library installation
- no service worker or PWA implementation (that belongs to a future hardening arc)

---

## Validation

- This is planning and design documentation only. No production code is changed.
- Mobile web remains the near-term default. No product decision has authorized native app development.
- Native mobile does not fork GearOps business logic. All shared architecture principles prohibit it.
- Dependencies on Arc 20V offline sync and future communications module are documented in Sections 6 and 8.
- Security and privacy boundaries are documented in Sections 5, 6, and 9.
- Pilot feedback requirements before native decision are documented in Section 14.
- No unsupported native capability is claimed as built in this arc.

---

## Definition of Done

- [x] GearOps native mobile readiness objective documented
- [x] Mobile web, PWA, and native options compared with trade-offs
- [x] Native mobile prerequisites documented
- [x] Device capability requirements documented
- [x] Offline/sync dependencies documented (tied to Arc 20V)
- [x] Scan/label mobile requirements documented
- [x] Notification dependencies documented (tied to Arc 20U)
- [x] Auth/security considerations documented
- [x] Mobile UX readiness standards documented
- [x] Future technical options documented without implementation
- [x] Pilot evidence needed before native decision documented
- [x] Future sequencing and non-goals documented
- [x] No native app implementation introduced

---

## Arc 20X Recommended Next Steps

Arc 20W completes the GearOps planning and architecture-readiness documentation layer. The following paths are appropriate candidates for Arc 20X, in priority order based on value and dependency:

1. **Mobile web / PWA hardening** — Address the highest-impact mobile web pain points identified in pilot feedback. This is the lowest-risk investment and does not require a native decision. Include: PWA manifest, installability, service worker read caching, offline-safe status banners, and scan flow performance improvements.

2. **Offline snapshot implementation** — If pilot feedback confirms offline access is a genuine operational blocker, implement the Arc 20V snapshot endpoint and local read cache. This delivers real offline value without a native app.

3. **Notification delivery module foundation** — If pilot feedback confirms that alert delivery is a missing capability, begin the communications module design. This enables push notifications on both web and native without requiring a native app decision first.

4. **Pilot synthesis and native decision gate** — Collect, synthesize, and document Arc 20R pilot feedback to produce a formal native vs PWA recommendation. This converts Arc 20W prerequisites into a concrete build decision.

Mobile web remains the default. Any of these arcs improves the field operator experience without the cost and risk of a native app commitment.
