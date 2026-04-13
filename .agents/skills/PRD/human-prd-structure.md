# Human PRD Structure Reference

The human-facing PRD is a .docx file with professional formatting. It is structured in exactly 8 mandatory sections that must NOT be mixed. Each section has a distinct audience and purpose.

## Document Metadata (Cover Page)

Before the sections, include a cover page with:
- Project name and tagline
- Client name
- Team members and roles
- Complexity level and timeline
- Document version and date

Followed by an auto-generated Table of Contents.

---

## Section 1 — Product Requirements Document (PRD)

**Audience**: Product managers, clients, non-technical stakeholders.
**Rule**: Define the product WITHOUT mentioning any technology. No database names, no framework names, no API names. Pure business logic.

Must include:

### 1.1 Problem Statement
What pain does this product solve? Be specific about the current manual process and its costs (time, errors, risk).

### 1.2 Users and Personas
Table format: Persona | Profile | Primary Need. At minimum 2-3 personas.

### 1.3 Use Cases
Table format: ID | Use Case | Actor. Cover all features from the scope.

### 1.4 User Flows (Step by Step)
Numbered step-by-step flows for:
- The main happy path (end to end)
- Each significant alternative path (fallbacks, error scenarios)
- Any parallel/background processes

Each step should be a concrete action, not a vague description. "User uploads file" not "file is received".

### 1.5 Functional Requirements
Table format: ID | Requirement | Priority (Must/Should/Could).

Every item from the original scope must appear here. Use MoSCoW prioritization. Must-haves are non-negotiable for MVP. Should-haves are important but deferrable. Could-haves are nice to have.

### 1.6 Non-Functional Requirements
Table format: ID | Requirement | Target Metric.

Include: availability, latency, throughput, resilience, security, data retention, recovery time, scalability, observability. Each with a measurable target.

### 1.7 Success Metrics
Bullet list of measurable outcomes that define "this system is working". Tie to business value.

### 1.8 Acceptance Criteria
Global criteria that the entire system must satisfy. These are the "smoke tests" for production readiness.

### 1.9 MVP Scope
Explicitly state what is IN and OUT of the MVP. For items excluded from MVP, explain when they'll be addressed. This prevents scope creep and sets expectations.

### 1.10 Scope Deviations Register
Table format: Scope Item | PRD Interpretation | Reason | Needs Client Confirmation (Y/N).

This section is MANDATORY even if empty. It's the contract between scope and implementation.

---

## Section 2 — System Architecture

**Audience**: Technical leads, senior engineers.
**Rule**: Now technology enters. Every component, database, API, and service is named and justified.

Must include:

### 2.1 Conceptual Diagram
ASCII or text-based system diagram showing components and data flows. Use monospace font.

### 2.2 Components
Table: Component | Technology | Responsibility. Every running process, database, external service.

### 2.3 Data Flows
Numbered step-by-step for each major flow (happy path, error path, background processes). Reference components from 2.2.

### 2.4 Data Model
Table: Table | Key Fields | Relationships. Cover every entity in the system.

### 2.5 External APIs
Table: API | Purpose | Auth Method | Rate Limits. Every external dependency.

### 2.6 Scalability Strategy
How does each component scale? What's the bottleneck? What changes at 10x load?

### 2.7 Fault Tolerance Strategy
What happens when each external dependency fails? Circuit breakers, retries, fallbacks, dead-letter queues.

### 2.8 Security Strategy
Data at rest, data in transit, credential management, access control, sensitive data handling.

---

## Section 3 — Architecture Decision Records (ADRs)

**Audience**: Current and future engineers who need to understand WHY decisions were made.
**Rule**: One ADR per significant technical decision. Minimum 5 ADRs for a complex project.

Each ADR must have exactly this structure:

### ADR-NNN: [Title framed as decision, not question]
- **Problem**: What technical challenge required a decision?
- **Options Considered**: Bullet list of 2-4 alternatives, each with a one-line description.
- **Decision**: Which option was chosen.
- **Technical Justification**: Why this option best serves the project's specific constraints.
- **Trade-offs**: What this decision costs. Every decision has downsides — name them honestly.

The ADRs should cover at minimum:
- Primary data store choice
- Job queue / scheduling mechanism
- Each major external integration approach
- Framework / runtime choice
- Any decision where the "obvious" choice was rejected

---

## Section 4 — Implementation Roadmap

**Audience**: Engineering managers, sprint planners, the development team.
**Rule**: Convert architecture into buildable work units.

Must include:

### 4.1 Milestone Overview
Table: Milestone | Weeks | Objective | Complexity | Dependencies.

### 4.2 Milestone Details
For each milestone:
- Deliverables as bullet list (concrete, testable items)
- Complexity estimate (Low/Medium/High)
- Dependencies on other milestones and external factors (credentials, access, etc.)

### 4.3 Technical Backlog (Checklist)
Complete checklist of every implementation task, organized by module/domain. Each item is a checkable box representing a single unit of work that can be independently verified.

This section is the "project tracker" — the team should be able to check items off as they complete them.

---

## Section 5 — Risk Analysis

**Audience**: Technical leads, project managers, stakeholders.
**Rule**: Organize risks by category. Each risk has probability, impact, and concrete mitigation.

Categories (use tables for each):
- **Architecture risks**: SPOF, coupling, complexity
- **Scalability risks**: volume growth, resource exhaustion
- **Security risks**: data exposure, credential compromise
- **Operational risks**: external service failures, team constraints
- **Maintenance risks**: dependency abandonment, technical debt

Table format: Risk | Probability | Impact | Mitigation.

---

## Section 6 — Simplification Pass

**Audience**: The pragmatic engineer who needs to ship.
**Rule**: Review the ENTIRE architecture from Sections 1-5 and challenge every complexity.

Must include:

### 6.1 Potentially Over-Engineered Components
Table: Component | Why It Might Be Overkill | Verdict (SIMPLIFY / KEEP / DEFER).

Be honest. If monitoring with Grafana+Loki is overkill for 3 devs, say so. If a circuit breaker takes 3 lines to implement and prevents cascading failures, keep it.

### 6.2 MVP Simplifications
Concrete list of what to cut, consolidate, or defer for MVP. Organized as:
- **Eliminate**: Remove entirely from MVP.
- **Consolidate**: Merge multiple components into one simpler component.
- **Defer**: Keep the interface but implement the simple version now, complex later.

### 6.3 Minimal Viable Architecture
Table showing the absolute minimum architecture that delivers all Must-have requirements. Compare against full architecture (component count, process count, dependencies).

End with a recommendation: what's achievable in the aggressive timeline vs. the full timeline.

---

## Section 7 — Visual Identity and Design System

**Audience**: Designer, front-end developer, AI agent responsible for design.
**Rule**: This section is MANDATORY when the system has a visual interface. It must be complete enough for the design to be executed without additional questions. If any item was not defined by the client, register it as "to be defined" with a justified recommendation. If the system has NO visual interface, include this section with a single line: "This system has no visual interface. Section not applicable."

### 7.1 Color Palette
Table: Token | Hex | Primary Use. Include: primary, secondary, background, surface, text, text-muted, border, success, warning, error. If dark mode, include variants for both themes.

### 7.2 Typography
Table: Level | Family | Size | Weight | Line Height | Use. Cover: H1-H4, body, small, label, monospace (if applicable).

### 7.3 Spacing and Grid
Document: base unit, spacing scale, max-width, grid columns, gutters, default border-radius.

### 7.4 Key Components
For each main system component (cards, tables, buttons, inputs, badges), describe the visual style: shadow, border, background, states (hover, focus, active, disabled, error).

### 7.5 Animations and Transitions
List of desired visual effects with specification: duration, easing curve, trigger. Include: page transitions, card entrance animations, hover effects, loading states.

### 7.6 Visual References
Table: Reference | What to Inspire. List products, sites, or applications the client admires and what should be inspired from each.

### 7.7 Screen Structure
Table: Screen | Purpose | Main Components | Navigation from/to. One row per system screen.

### 7.8 Items to Define
List of visual elements that were not specified and need a decision before implementation.

---

## Section 8 — Security Analysis for Vibe Coding

**Audience**: Tech lead, developer, and the AI agent that will implement the system.
**Rule**: This section is MANDATORY regardless of the system. It identifies the specific risks of implementation by AI agents and establishes the necessary protections.

### 8.1 System Risk Level
Classification (High / Medium / Low) with justification based on processed data, attack surfaces, and business criticality.

### 8.2 Identified Attack Surfaces
Table: Surface | Attack Vector | Probability | Impact | Mandatory Mitigation.

Mandatorily consider for this type of system:
- Exposed endpoints
- User inputs
- Integrations with external APIs
- Database access
- Credential management
- AI prompts (if applicable)
- Incoming webhooks

### 8.3 Natural AI Agent Failure Modes (Vibe Coding Risks)
Table: Failure | Why It Happens | Prevention in PRD.

Document failures that naturally occur in vibe coding implementations:
- Hardcoded credentials in code
- Endpoints created without authentication "to test faster"
- SQL queries with string concatenation
- Logs with sensitive data
- Direct database editing via inspection tools without controls
- Prompt injection via user input

### 8.4 Pre-Deploy Security Checklist
Verification list that the AI agent must execute before considering the implementation complete. System-specific items.

### 8.5 Compliance Requirements
If applicable: LGPD, GDPR, PCI-DSS, or other regulatory frameworks relevant to the system. For each: what applies and what the system must do to be compliant.

---

## Formatting Standards

- Use Arial font throughout.
- Heading 1: 18pt, bold, dark blue (#1B3A5C)
- Heading 2: 14pt, bold, medium blue (#2E75B6)
- Heading 3: 12pt, bold, red (#C0392B) — used for ADR titles and sub-sections
- Body text: 11pt
- Tables: alternating row shading, dark blue header with white text
- Page numbers in footer
- Document title in header
- Use the docx skill for generation
