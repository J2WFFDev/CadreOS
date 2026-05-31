# Sports Court, Field & Clubhouse Reservation Platform Guide
### With Approval Workflows & Qualification Validation

**Prepared:** May 2026  
**Use Case:** Multi-resource sports facility reservations requiring credential/qualification verification and multi-step approval workflows

---

## ⚠️ Note on "Shedding"

No recognized sports reservation platform named **"Shedding"** exists in the current market. You may be thinking of **Skedda** — a popular space and court reservation tool. This guide covers **Skedda**, **CourtReserve**, and **JotForm**, as you requested, along with a summary of other strong alternatives.

---

## 1. Platform Overviews

---

### 🏆 CourtReserve
**Best Overall for Racquet & Multi-Sport Clubs**

CourtReserve is a purpose-built, all-in-one court reservation and club management platform designed specifically for racquet and paddle sports (tennis, pickleball, squash, padel) and multi-sport facilities.

**Key Features:**
- Real-time online court booking with configurable booking windows and rules
- Member management with membership tiers, approvals, and waivers
- Automated email/SMS alerts and notifications
- Waitlist management and cancellation automation
- Payment processing and POS integration
- League and tournament scheduling tools
- Custom fields for qualification/certification data collection
- Membership agreement and liability waiver signing (digital)
- Admin approval flows for memberships and program registrations
- Mobile app for both admins and members (iOS & Android)
- Detailed reporting and analytics dashboard
- Website and API integration

**Approval & Qualification Workflow:**
CourtReserve supports member approval processes where admins must review and approve new member registrations before access is granted. Waivers, agreements, and custom intake fields can be configured to capture qualification data. Membership types can be gated so only approved members with the right tier can book specific courts or resources. As of Q1 2026, the platform received major updates to admin workflows, player validation tools, and event registration systems.

**Pricing:**
- Starts at ~$99/month for small clubs (up to 4 courts)
- Scales to $200–$500+/month for mid-to-large facilities
- Custom enterprise quotes available

**Best For:**
- Racquet sports clubs (tennis, pickleball, squash, padel)
- Mid-to-large clubs needing robust member + reservation management
- Facilities requiring waitlists, leagues, and POS in one platform

**Limitations:**
- Primarily designed for racquet sports; less ideal for field sports (soccer, baseball, etc.)
- No open public API (as of 2026)
- Approval workflow for bookings is tied to membership tier rather than per-booking approval routing

---

### 🔧 JotForm (with Workflows)
**Best for Custom Qualification Validation & Multi-Step Approvals**

JotForm is a highly flexible form-and-workflow builder that, when combined with its **Approvals** and **Workflows** products, can power a fully customized sports facility reservation system with robust qualification gating and multi-step human approvals.

**Key Features:**
- Drag-and-drop form builder (no coding required)
- Reservation workflow templates (including Facility Use Approval)
- Multi-step approval chains with conditional routing
- Group approvals and parallel approver assignments
- Automatic confirmation/rejection emails to applicants
- Conditional logic: route requests based on qualification answers
- Integration with 40+ payment gateways (Stripe, PayPal, Square, etc.)
- Digital signatures and document collection
- JotForm Tables and Inbox for tracking pending approvals
- Connects to Google Calendar, Salesforce, Slack, Zapier, and more
- White-label and branded form options

**Approval & Qualification Workflow:**
JotForm's approval engine is highly customizable for qualification validation. You can build a reservation form that:
1. Collects qualifications (certifications, skill levels, membership status)
2. Routes the submission through one or more approvers
3. Applies conditional logic — e.g., "If applicant has Level 2 certification → auto-approve; if not → route to director for review"
4. Sends automated confirmation or denial emails
5. Triggers calendar events or payment requests upon approval

JotForm has a dedicated **Facility Use Approval Workflow Template** and supports multi-level approval hierarchies.

**Pricing:**
- Free tier: up to 5 forms, 100 monthly submissions
- Bronze: $34/month
- Silver: $39/month
- Gold: $49/month
- Enterprise: custom pricing
*(Prices as of 2026; check jotform.com for current rates)*

**Best For:**
- Organizations needing highly custom, qualification-gated approval workflows
- Schools, community centers, HOAs, multi-use facilities
- Situations where different resource types have different approvers and rules
- Teams already using tools like Google Sheets, Slack, or Salesforce

**Limitations:**
- Not a purpose-built reservation/scheduling platform — calendar/availability views require add-ons or integrations
- No native real-time court availability calendar (must integrate with Google Calendar or similar)
- Requires setup and configuration effort to match dedicated reservation software
- Storage and submission caps on lower-tier plans

---

### 📅 Skedda
**Best for Clean Space/Court Scheduling with Access Rules**

Skedda (likely the platform you referred to as "Shedding") is a user-friendly, cloud-based space reservation platform focused on clean scheduling for facilities of all types — courts, fields, studios, conference rooms, and clubhouses.

**Key Features:**
- Interactive visual booking calendar (day/week/month views)
- Real-time availability and conflict prevention
- Configurable booking rules (who can book what, when, and for how long)
- User groups and access tiers (e.g., members vs. guests vs. staff)
- Conditional booking logic and approval gates
- Online payment integration (Stripe)
- Public booking pages and embeddable widgets
- Custom form fields to collect qualifications or attestations during booking
- Email confirmations and reminders
- Multi-location support
- SSO and directory integrations (Google, Microsoft)

**Approval & Qualification Workflow:**
Skedda supports approval-required bookings where administrators must review and approve reservation requests before they are confirmed. User tags and groups can enforce access control, ensuring only qualified or approved users can see and book specific resources. Custom intake fields during booking allow collection of qualification attestations.

**Pricing:**
- Free tier available (limited features and spaces)
- Core: starts at ~$99/month
- Pro and Enterprise: higher tiers with more spaces, integrations, and SSO
*(Check skedda.com for current pricing)*

**Best For:**
- General-purpose facilities (courts, fields, classrooms, studios, clubhouses)
- Organizations that need clean UI and self-service booking with admin approval gates
- Multi-resource and multi-location venues
- Corporate campuses, co-working spaces, community centers, HOAs

**Limitations:**
- Less sports-specific than CourtReserve (no native leagues, tournaments, or scoring)
- Qualification validation is form-based, not certificate/credential-database-integrated
- Less robust member management than CourtReserve

---

## 2. Platform Comparison Matrix

| Feature | CourtReserve | JotForm | Skedda |
|---|---|---|---|
| **Purpose-built for sports** | ✅ Yes (racquet sports) | ❌ General | ⚠️ Partial |
| **Real-time availability calendar** | ✅ Yes | ❌ Needs integration | ✅ Yes |
| **Multi-step approval workflow** | ⚠️ Membership-level | ✅ Full conditional | ✅ Basic approval gate |
| **Qualification validation** | ⚠️ Custom fields + tiers | ✅ Conditional logic | ⚠️ Custom intake fields |
| **Automated approve/deny emails** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Payment processing** | ✅ Native POS | ✅ 40+ gateways | ✅ Stripe |
| **Member management** | ✅ Full CRM | ⚠️ Tables/basic | ⚠️ User groups |
| **Leagues & tournaments** | ✅ Yes | ❌ No | ❌ No |
| **Mobile app** | ✅ iOS & Android | ✅ Mobile-friendly | ✅ Mobile-friendly |
| **No-code setup** | ⚠️ Moderate setup | ✅ Easy drag-and-drop | ✅ Easy setup |
| **API / Integrations** | ❌ Limited | ✅ Extensive (Zapier, etc.) | ✅ Google, Microsoft, Zapier |
| **Clubhouse/field support** | ⚠️ Courts primary | ✅ Any space | ✅ Any space |
| **Starting price** | ~$99/mo | Free / $34+/mo | Free / ~$99/mo |

---

## 3. Recommendation

### ✅ Recommended Primary Platform: **JotForm + Skedda (Combined)**

For your specific requirement — **approval workflows with qualification validation** across courts, fields, and clubhouses — no single platform is a perfect all-in-one. The optimal architecture is:

**Use Skedda for:**
- The member-facing booking calendar and real-time availability
- Access control rules (which user group can book which resource)
- Approval gating on reservations
- Embedding on your website or app

**Use JotForm for:**
- A one-time qualification/credential intake form for new members
- Multi-step admin approval of member qualifications
- Conditional routing: "If applicant holds required certification → approve for court access; if not → route to committee for review"
- Digital signatures on waivers and liability agreements
- Integration with your existing tools (Google Sheets, email, Slack)

**Connect them via Zapier or webhooks** so that a JotForm approval triggers the creation or upgrade of a Skedda user account, granting appropriate booking access.

---

### 🥈 Alternative: **CourtReserve** (if primarily racquet sports)

If your facility is primarily a **tennis, pickleball, or racquet sports club**, CourtReserve is the strongest single-platform solution. It handles reservations, member approvals, waivers, payments, and leagues natively — though its qualification workflow is tied to membership tiers rather than a flexible multi-step approval engine.

---

### 🥉 Also Consider: **SportsKey** (formerly BookAPitch)

SportsKey is purpose-built for sports fields and parks departments. It offers:
- Multi-field scheduling and permit workflows
- Community-facing booking portals
- Automated approvals and availability dashboards
- Financial reporting and invoicing

Ideal for **municipalities, parks departments, and multi-field venues** (soccer, baseball, lacrosse).

---

## 4. Suggested Implementation Roadmap

If building this system from scratch using the JotForm + Skedda approach:

**Phase 1 – Foundation (Weeks 1–2)**
- Set up Skedda workspace with all courts, fields, and clubhouse spaces
- Define user groups (e.g., Full Member, Guest, Junior, Staff)
- Configure booking rules per resource type

**Phase 2 – Qualification Intake (Weeks 2–3)**
- Build JotForm qualification intake form with required fields:
  - Member details
  - Certifications / skill level declarations
  - Waiver e-signature
  - Supporting document uploads (if needed)
- Design approval workflow: who approves which qualification category

**Phase 3 – Approval Automation (Weeks 3–4)**
- Set up conditional approval routing in JotForm
- Configure auto-approve for clear-cut qualifications
- Configure human-review routing for borderline cases
- Connect JotForm approval completion → Zapier → Skedda user creation/upgrade

**Phase 4 – Go Live & Training (Week 5)**
- Test end-to-end booking flow
- Train admin staff on approval dashboard (JotForm Inbox)
- Onboard members via email campaign

---

## 5. Key Questions to Refine Your Choice

Before finalizing a platform, answer these:

1. **What sports/resources?** Primarily racquet sports → CourtReserve. Mixed (courts + fields + clubhouse) → JotForm + Skedda or SportsKey.
2. **How complex are your qualification rules?** Simple tiers → any platform. Complex conditional logic → JotForm.
3. **Do you need leagues/tournaments?** Yes → CourtReserve required.
4. **What's your budget?** Tight budget → JotForm free tier + Skedda free tier to start.
5. **Do you have an existing website/app?** Skedda and CourtReserve both offer embeddable booking widgets.
6. **How many approvers?** Multiple with different roles → JotForm Workflows handles this best.

---

## 6. Useful Links

| Platform | URL |
|---|---|
| CourtReserve | https://courtreserve.com |
| JotForm Approvals | https://jotform.com/products/approvals |
| JotForm Facility Use Workflow Template | https://jotform.com/workflow-templates |
| Skedda | https://skedda.com |
| SportsKey | https://sportskey.com |
| Zapier (automation connector) | https://zapier.com |

---

*This guide reflects platform capabilities and pricing as of May 2026. Always verify current pricing and features directly with each vendor before making a purchase decision.*
