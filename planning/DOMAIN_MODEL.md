# CadreOS Domain Model (Initial)

## Core Entities
- Organization
- Program
- Team
- Season
- Person
- UserAccount
- RoleAssignment
- Relationship
- AthleteProfile
- Note
- MessageThread
- Event
- RSVP
- AttendanceRecord
- Task
- Goal
- DevelopmentPlan
- IncidentReport
- ConsentDocument
- Asset
- AssetAssignment
- AuditEvent

## Key Relationships
- Organization has many Programs
- Program has many Teams and Seasons
- Team has many People through RoleAssignments
- Person may map to one UserAccount and multiple Roles
- Person relates to Person through Relationship (parent/guardian/coach/etc.)
- AthleteProfile belongs to Person
- Notes can reference AthleteProfile, Team, Event, and author Person
- Event belongs to Team/Program and has many RSVPs and AttendanceRecords
- MessageThread has participants (People) and routing metadata
- Task references owner Person and optional source (Note/Message/Event)
- DevelopmentPlan belongs to AthleteProfile and contains Goals
- AssetAssignment links Asset to Person/Team with lifecycle status
- AuditEvent references actor, entity, and action

## Access Control Model
- Role-based authorization with contextual scope (organization/program/team)
- Relationship-aware visibility for guardians and support staff
- Restricted health/safety data by policy

## Lifecycle Concepts
- Season lifecycle: planned -> active -> completed -> archived
- Event lifecycle: draft -> published -> completed -> archived
- Task lifecycle: open -> in_progress -> blocked -> done -> cancelled
