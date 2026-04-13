---
name: prd-master
description: "Generate comprehensive, production-grade technical product documents (PRDs) for systems involving automations, AI, APIs, and digital infrastructures. Use this skill ALWAYS when the user explicitly asks for a PRD — and ONLY when explicitly requested. The skill conducts a mandatory interview OR audits a provided scope document before generating anything, researches the system's domain on the web, and produces TWO outputs: a .docx for stakeholders and a .md optimized for AI coding agents (Claude Code, Gemini, Cursor). Never assumes anything about the system — everything is elicited or researched. Includes a dedicated security checklist for vibe coding, focused on natural AI agent failure modes."
---

# PRD Architect

A skill for generating rigorous, production-grade technical product documents from project scopes. Produces both a human-facing .docx (for stakeholders and developers) and an AI-facing .md (for AI coding agents such as Claude Code, Gemini, Cursor, and others).

---

## Non-Negotiable Principles

**1. Scope Fidelity** — The original scope is sacred. Every item MUST appear in the final document, either implemented as described, enhanced with additional detail, or explicitly flagged with a reasoned explanation of why the original approach should change. The skill NEVER silently drops, reinterprets, or substitutes scope items. If the scope says "send via WhatsApp AND email", the document cannot quietly turn email into a fallback without calling this out as a deviation and justifying it.

**2. Justified Rigor** — The document is thorough and technically deep, but every piece of complexity earns its place. Before including any technology, pattern, or component, ask: "Is this here because the problem demands it, or because it's trendy?" If the answer is trend, it gets cut. If the answer is problem-driven, it stays regardless of how complex it is.

**3. Anti-Overengineering as a Dedicated Pass** — The full architecture comes first (the "right" one). Then a mandatory simplification pass identifies the real MVP. Two separate passes, never mixed. This prevents the rigor of earlier sections from producing an unbuildable system.

**4. Zero Assumptions** — The skill NEVER assumes stack, database, visual style, credentials, data volume, user profile, or any system detail. Everything is elicited in the interview/scope audit or researched on the web. If something was not provided and cannot be researched with confidence, BLOCK AND ASK.

**5. Reinforced Security for Vibe Coding** — PRDs generated for AI agents have a stricter security section than standard. Natural AI agent failure modes (API keys in code, unauthenticated endpoints, prompt injection, SQL without prepared statements, direct DB editing via inspection tools) are explicitly listed as anti-patterns with imperative instructions.

---

## Reference Files

Read BOTH before generating any document:

- `references/human-prd-structure.md` — Structure and rules for the human-facing .docx (Sections 1-8)
- `references/ai-prd-structure.md` — Structure and rules for the AI-facing .md

---

## Workflow

### PHASE 0: Scope Acquisition (NEVER SKIP THIS PHASE)

There are two entry paths. Determine which applies:

**Path A — User provides a scope document.** Read the document completely. Extract every requirement, constraint, and observation. Then proceed to Phase 1 (Scope Audit). If the scope has critical gaps or ambiguities that would significantly alter the architecture, block and ask before proceeding.

**Path B — No scope document provided.** Conduct a dynamic interview tailored to this specific project. Do NOT generate anything until you have sufficient information.

ABSOLUTE RULE: If any answer is vague, incomplete, or contradictory on a point that impacts architecture or security, block and ask for clarification. Never advance with an assumption.

#### How the Dynamic Interview Works

There are NO fixed questions. Instead, follow this process:

1. **Read whatever the user has provided** — even a single sentence like "I need a billing system" contains signals. Analyze it for: domain, implied features, scale hints, integration clues, user type, and complexity indicators.

2. **Generate questions tailored to THIS project.** Based on what you inferred from the user's initial input, produce questions that target the specific gaps and unknowns for THIS system. Organize them in thematic blocks.

   The questions must cover whatever is relevant to the project. Typical dimensions to consider (but ONLY ask about dimensions that apply):
   - Core problem and business context
   - Features and user flows
   - Integrations and external APIs
   - Stack and infrastructure constraints
   - Security and sensitive data
   - Visual identity and UX (only if the system has a UI)
   - Scale, availability, and monitoring

   DO NOT ask about dimensions that are clearly irrelevant. An API-only automation needs zero questions about visual identity. A static landing page needs zero questions about database schema. A CLI tool needs zero questions about page transitions.

3. **Calibrate depth per dimension.** If the user already gave detailed info about a dimension, ask only about gaps in that dimension. If a dimension was not mentioned at all but is critical, ask deeper questions about it. If a dimension is tangential, ask one broad question or skip it entirely.

4. **Present all questions in a single organized block.** Group by theme, number them, and deliver in one message. Aim for the minimum number of questions that extracts maximum architectural clarity — typically 8-20 questions depending on project complexity. A simple CRUD app might need 8. A multi-integration financial system might need 20+.

5. **After receiving answers, decide if a follow-up round is needed.** If the answers are complete and clear, proceed to Phase 1. If answers reveal new complexity, contradictions, or critical gaps that weren't visible before, generate a focused follow-up round targeting ONLY the new unknowns. Do NOT repeat questions already answered. Typically 0-1 follow-up rounds are needed. If the project is exceptionally complex, a second follow-up is acceptable but rare.

#### What Makes a Good Dynamic Question

- **Specific to the project**: "Which payment gateway will you use — Stripe, Mercado Pago, or another?" instead of generic "Does the system process payments?"
- **Architecturally decisive**: Every question should have the potential to change a technical decision in the PRD. If the answer wouldn't change anything, don't ask.
- **Concrete**: "What happens when the WhatsApp API is down — queue and retry, or skip and notify?" instead of "How should errors be handled?"
- **Non-obvious**: Don't ask things you can infer. If the user said "n8n automation", don't ask "Will there be automated workflows?"

---

### PHASE 1: Scope Audit

Whether the input came from Path A (scope document) or Path B (interview answers):

1. Build a complete inventory: list every feature, integration, restriction, and deliverable mentioned.
2. Identify ambiguities — places where the scope is vague or could be interpreted multiple ways.
3. Identify gaps — things the scope doesn't mention but the system will clearly need (e.g., authentication, error handling, deployment).
4. Present the user with a summary: "Here's what I found. These items are clear. These items are ambiguous and I need clarification. These items are missing and I recommend adding."

Do NOT proceed to writing until ambiguities are resolved or the user says to proceed with best judgment.

---

### PHASE 2: Domain and Technology Research

#### Domain Research (Niche)
After the scope is clear, research the system's domain on the web. This phase is internal — results are incorporated into the PRD, not presented as a separate section.

Research the following:
1. **Similar systems in the niche** — what do these systems normally include? What features are market standard?
2. **Common errors and failures** — what typically goes wrong in systems of this type? What are the typical technical debts?
3. **UX/UI references for the niche** — consolidated visual and interaction patterns for this type of system
4. **APIs and integrations in the niche** — which are most used? Are there mature, well-maintained SDKs?
5. **Niche-specific security** — what attack vectors are most common for this type of system?
6. **Validated tech stack** — which technologies dominate this niche in 2025-2026?

Use the results to:
- Add niche-standard features the user didn't mention but that make sense
- Anticipate domain-specific technical risks
- Support stack choices with real references
- Strengthen the security section with known niche threats
- Inform UX and visual identity recommendations

#### Technology Research
For each technology decision:
1. Search the web for the current state of each candidate technology (2025-2026).
2. Identify the most obvious/default choice for each need.
3. Explicitly evaluate whether that default choice serves THIS project's specific constraints.
4. If the default is wrong for this project, explain why and recommend the alternative.
5. If the default is right, say so — don't choose something exotic just to seem thorough.

The goal is to arrive at a stack where every component is there because the problem demands it.

---

### PHASE 3: Scope Deviation Register

Before writing the documents, create a register of every place where the PRD deviates from the original scope. For each deviation:

- What the scope said
- What the PRD does instead
- Why the change was made
- Whether this needs client confirmation

This register appears in the human document as a mandatory subsection. Nothing is hidden.

---

### PHASE 4: Document Generation

Generate both documents:

1. **Human PRD (.docx)** — Follow `references/human-prd-structure.md`. Use the docx skill for creation.
2. **AI PRD (.md)** — Follow `references/ai-prd-structure.md`. Plain Markdown file.

Both documents are generated from the same analysis. The human version explains trade-offs and context. The AI version gives deterministic instructions.

---

### PHASE 5: Delivery

Present both files to the user with a brief summary of:
- Key architectural decisions and justifications
- Scope deviations that need client confirmation
- Simplifications recommended for MVP
- Critical security risks identified

---

## Critical Rules

### On Zero Assumptions
- If the interview/scope didn't cover something essential, ASK. Never invent.
- "I'll use PostgreSQL because it's the default" is not acceptable if the user didn't confirm the database.
- If the user says "I don't know" to a technical question, research the niche standard and present a justified recommendation for confirmation.

### On Scope Fidelity
- NEVER silently drop a scope item. If something from the scope doesn't appear in the PRD, it's a bug.
- If a scope item should be changed, explicitly flag it in the "Scope Deviations" section with reasoning.
- If a scope item is ambiguous, ask the user or document both interpretations with a recommendation.
- The Scope Deviations register is mandatory. Even if there are zero deviations, include the section stating "No deviations from original scope."

### On Technology Choices
- Every technology must justify its presence by the problem it solves, not by popularity.
- For each choice, name the most obvious alternative and explain why it was or wasn't selected.
- Web search is mandatory before finalizing any technology choice. Training data may be outdated.
- If the user's scope already specifies a technology, validate it via research but do not override it without strong justification and explicit flagging.

### On Complexity
- The full architecture (Sections 1-6 of human doc) should be the "right" architecture — complete, production-grade, no corners cut.
- The Simplification Pass (Section 6) then identifies what can be deferred for MVP.
- This two-pass approach means the team has both the target architecture AND the minimal starting point.

### On Security for Vibe Coding

The PRD MUST include a security section with imperative instructions adapted to the system. The following rules are MANDATORY in any PRD:

```
SECURITY — IMPERATIVE INSTRUCTIONS FOR THE AI AGENT

CREDENTIALS AND CONFIGURATION:
- NEVER hardcode API keys, tokens, passwords, or credentials in code
- USE environment variables for ALL sensitive configuration
- NEVER commit .env files — add to .gitignore BEFORE any commit
- NEVER log environment variable values

DATABASE:
- NEVER build SQL queries with string concatenation
- USE prepared statements / parameterized queries in ALL database interactions
- NEVER expose endpoints that allow direct table modification without authorization validation
- NEVER allow database access via inspection tools (TablePlus, DBeaver, etc.) in production without IP control and strong authentication
- IMPLEMENT least privilege: each service accesses only the tables it needs

ENDPOINTS AND APIS:
- NEVER create an endpoint without authentication, even if "temporary" or "just for testing"
- VALIDATE and SANITIZE all input before processing — forms, webhooks, URL parameters
- IMPLEMENT rate limiting on all public endpoints
- NEVER expose stack traces or detailed errors to end users — log internally, return generic message

SENSITIVE DATA:
- NEVER store sensitive data in logs (PII, tokens, financial data)
- MASK sensitive data before logging (e.g., show only last 4 digits)
- NEVER transmit sensitive data in URL query strings

[ADD SYSTEM-SPECIFIC RULES HERE based on security items identified in the interview and niche research]
```

For systems with AI, add:
```
AI AND PROMPTS:
- NEVER pass user input directly to the prompt without sanitization
- IMPLEMENT prompt injection validation for all user text that reaches the model
- NEVER expose the system prompt or internal AI configuration to the end user
- NEVER allow the model to take irreversible actions without human confirmation in the flow
- LIMIT the context the model receives to the minimum necessary for the task
```

### On the AI Document (.md)
- The .md must be self-contained. An AI agent reading ONLY this file should be able to build the entire system without referring to the .docx.
- Use imperative language: "USE X", "DO NOT USE Y", "CONFIGURE as follows" — never "consider using" or "you may".
- Include exact code snippets: SQL schemas, TypeScript/Python interfaces, env var names, directory structures, prompt templates.
- Include an "Anti-Patterns to Avoid" section that prevents the AI from making common substitutions (e.g., using Express when Fastify was chosen).
- Implementation steps must be ordered by dependency. Each step includes a concrete test criterion.

### On Visual Identity
- NEVER assume color palette, typography, or style without user confirmation.
- If the user has partial references, document what is known and mark the rest as "to be defined with design".
- The visual identity section must be rich enough for the AI agent to generate a coherent design without asking additional questions. Include: hex palette, typography (family + weight + size for each level), base spacing, component styles, desired animations, and visual references.

### On Asking Questions
- Ambiguities that alter architecture = block and ask.
- Minor ambiguities (naming, formatting) = proceed with best judgment and document as assumption.
- Unspecified external system interfaces (APIs, databases) = flag as explicit blocker. Never guess.
