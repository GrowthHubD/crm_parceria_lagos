# AI PRD Structure Reference

The AI-facing PRD is a Markdown (.md) file optimized for consumption by AI coding agents (Claude Code, Gemini, Cursor, and others). It must be self-contained: an AI agent reading ONLY this file should be able to build the entire system without any other document.

## Key Differences from Human PRD

| Aspect | Human PRD | AI PRD |
|--------|-----------|--------|
| Explains "why" | Yes, extensively | Minimal — only when it prevents wrong decisions |
| Names alternatives | Yes (ADRs) | No — only the chosen option exists |
| Uses business language | Yes (Section 1) | No — everything is technical |
| Includes trade-offs | Yes | No — decisions are final |
| Has code snippets | No | Yes — exact SQL, TypeScript, prompts |
| Has file structure | No | Yes — complete directory tree |
| Has env variables | No | Yes — every variable with description |
| Anti-patterns listed | No | Yes — critical for preventing AI drift |
| Implementation order | By milestone (weeks) | By dependency (steps 1, 2, 3...) |
| Visual identity specs | Descriptive | Exact tokens, hex values, px values |
| Security section | Analytical | Imperative manifest — read before coding |

## Document Structure

The AI PRD has these sections in this exact order:

### 1. CONTEXT
2-3 paragraphs maximum. What is being built, for whom, and what's the single most important constraint the AI must never violate. This is the "system prompt" for the project.

### 2. TECH STACK
Table format: Component | Technology | Version. Mark as "non-negotiable". The AI must not substitute any of these. If it encounters a problem with a chosen technology, it should report the issue rather than silently switch.

### 3. PROJECT STRUCTURE
Complete directory tree using code block. Every file that will exist in the final project. Use descriptive comments for each file's purpose. The AI should create this structure before writing any code.

### 4. DATABASE SCHEMA
Complete SQL migrations. Not a description — the actual CREATE TABLE statements with:
- Column types, constraints, defaults
- Indexes (including unique constraints for deduplication)
- Foreign keys
- Comments explaining non-obvious fields

Use TIMESTAMPTZ for all timestamps. Use TEXT for enum-like fields (not Postgres ENUM — easier to evolve). Use UUID for primary keys.

### 5. QUEUE/JOB DEFINITIONS (if applicable)
TypeScript/Python interfaces for every job payload. Queue configuration (rate limits, retry policies, cron schedules). Constants for queue names.

### 6. IMPLEMENTATION RULES
Numbered rules that apply globally. These are the "coding standards" for this project. Examples:
- Error handling patterns (try/catch, structured errors, logging)
- Idempotency requirements
- Logging format and sensitive data masking
- Template formats (exact content of message templates)
- AI/LLM prompt templates (exact system prompts, model IDs, parameters)
- External API interaction patterns (auth, retry, circuit breaker config)

Each rule should be specific enough that an AI can check its own code against it.

### 7. ENV VARIABLES
Complete .env file with every variable, commented. Group by service. Include example values where safe (never real credentials). The AI uses this to know what configuration exists.

### 8. IMPLEMENTATION ORDER
Numbered steps, each with:
- What to build (specific files/modules)
- How to test it (concrete test command or verification)
- What must be true before moving to the next step

Steps are ordered by dependency: step N depends only on steps 1 through N-1. The AI should never need to jump ahead or backtrack.

Each step ends with a **Test** line that describes how to verify the step works. This is the acceptance criterion — the AI should run this test before proceeding.

### 9. ANTI-PATTERNS TO AVOID
Numbered list of "DO NOT" rules. These prevent the AI from making common substitutions based on its training data (e.g., using Express when Fastify was chosen, using Prisma when raw pg was chosen, using console.log when Pino was chosen).

This section is critical. Without it, AI agents tend to drift toward their most-seen patterns regardless of what the spec says.

### 10. VISUAL IDENTITY AND DESIGN SYSTEM

This section is MANDATORY when the system has a visual interface. It must be rich enough for the AI agent to generate a coherent design without asking additional questions. If the system has NO visual interface, include a single line: "This system has no visual interface. Section not applicable."

Include the following with exact values:

#### Color Palette
```
PRIMARY:    #XXXXXX  — [use: main buttons, CTAs, headers]
SECONDARY:  #XXXXXX  — [use: support elements, icons]
BACKGROUND: #XXXXXX  — [use: general background]
SURFACE:    #XXXXXX  — [use: cards, modals, panels]
TEXT:       #XXXXXX  — [use: main text]
TEXT_MUTED: #XXXXXX  — [use: secondary text, labels]
BORDER:     #XXXXXX  — [use: borders, dividers]
SUCCESS:    #XXXXXX
WARNING:    #XXXXXX
ERROR:      #XXXXXX
```

#### Typography
```
FONT_FAMILY_PRIMARY: [font name] — [fallback font]
FONT_FAMILY_MONO:    [mono font name, if applicable]

H1: [size]px / [weight] / [line-height]
H2: [size]px / [weight] / [line-height]
H3: [size]px / [weight] / [line-height]
BODY: [size]px / [weight] / [line-height]
SMALL: [size]px / [weight] / [line-height]
LABEL: [size]px / [weight] / [letter-spacing]
```

#### Spacing and Grid
```
BASE_UNIT: [value]px
SPACING: [4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px]
BORDER_RADIUS: [value]px (default) / [value]px (cards) / [value]px (buttons)
MAX_WIDTH: [value]px
GRID_COLUMNS: [number]
GUTTER: [value]px
```

#### Component Styles
- Cards: [describe: shadow, border, background, hover state]
- Buttons: [describe: primary style, secondary, ghost, disabled]
- Inputs: [describe: border, focus, error, disabled]
- Tables: [describe: header, alternating rows, hover]
- Badges/Tags: [describe: color variants, size]

#### Animations and Transitions
```
TRANSITION_DEFAULT: [duration]ms ease-[type]
TRANSITION_FAST:    [duration]ms ease-[type]
HOVER_LIFT:        translateY(-Xpx) + shadow (if applicable)
PAGE_TRANSITION:   [describe the effect when navigating between pages]
CARD_ENTRANCE:     [describe card entrance animation]
[other specific effects requested]
```

#### Visual References
- [Link or product name 1] — [what to inspire from this design]
- [Link or product name 2] — [what to inspire from this design]

#### Mode
- [ ] Light only
- [ ] Dark only
- [ ] Both (specify how to toggle)

#### Screen Structure
List of all system screens/pages with:
- Screen name
- Primary purpose
- Key components present
- Transition from/to which other screens

---

### 11. SECURITY MANIFEST

This section is MANDATORY in ALL PRDs, regardless of the system. It is the last section of the document and must be read by the agent BEFORE writing any code.

```markdown
## SECURITY MANIFEST — READ BEFORE WRITING ANY CODE

### SYSTEM RISK LEVEL
[HIGH / MEDIUM / LOW] — [justification in 1 line]

### IDENTIFIED ATTACK SURFACES
- [list of attack surfaces specific to this system]

### IMPERATIVE RULES

#### Credentials
- NEVER hardcode credentials in source code
- USE .env for all sensitive configuration — .env is in .gitignore
- NEVER log environment variable values

#### Database
- NEVER use string concatenation in SQL queries
- USE prepared statements in ALL queries
- NEVER expose direct database editing endpoints without authorization + audit
- Database access via inspection tools (TablePlus, pgAdmin, etc.) requires: SSL + IP whitelist + separate read-only user

#### Inputs and Endpoints
- VALIDATE and SANITIZE all external input before processing
- NEVER create an endpoint without authentication, not even temporarily
- IMPLEMENT rate limiting on public endpoints: max [X] req/min per IP
- RETURN generic error messages to the user, detailed log only internally

#### Sensitive Data
- MASK sensitive data in logs: [list of fields to mask in this system]
- NEVER transmit sensitive data in query strings
- APPLY LGPD/GDPR: [list of specific obligations identified for this system]

[AI SECTION — include only if the system uses AI]
#### AI and Prompts
- SANITIZE user inputs before including in prompts
- VALIDATE against prompt injection in all user text
- NEVER expose system prompts to the user
- NEVER allow irreversible actions without human confirmation

### PRE-DEPLOY CHECKLIST
- [ ] No hardcoded credentials in code
- [ ] .env not committed to repository
- [ ] All endpoints authenticated
- [ ] Rate limiting configured
- [ ] Logs contain no PII or tokens
- [ ] Prepared statements in all queries
- [ ] Stack traces not exposed to end user
- [ ] [system-specific items]
```

---

## Writing Guidelines

### Be Deterministic
The AI PRD should produce identical (or nearly identical) implementations regardless of which AI agent reads it. Avoid phrases like "choose an appropriate..." or "consider using...". Instead: "Use X. Configure it as follows."

### Be Concrete
Instead of "validate the input", write "validate each row: empresa (non-empty string), whatsapp (matches regex /^55\d{10,11}$/), cnpj (exactly 14 digits, passes mod-11 check)".

### Be Complete
If the system sends emails, include the exact HTML template. If it calls an API, include the exact endpoint, method, headers, and expected response shape. If it uses an LLM, include the exact prompt, model ID, temperature, and max_tokens.

### Be Explicit About What NOT To Do
AI agents often "help" by adding features or dependencies not in the spec. The Anti-Patterns section prevents this. Common anti-patterns to guard against:
- Adding ORMs when raw SQL was specified
- Adding template engines when simple string replacement was specified
- Creating microservices when a monolith was specified
- Adding a web dashboard when API-only was specified
- Using a different database, framework, or runtime than specified
- Adding authentication/authorization beyond what was specified

### Respect the Implementation Order
The order matters. Each step builds on the previous. If the AI tries to implement step 7 before step 3, it will make wrong assumptions. The order should make it impossible to build things in the wrong sequence.

### Include Type Definitions
For TypeScript/Python projects, include interface/type definitions for:
- All database row types
- All API request/response shapes
- All job payloads
- All configuration objects

These types serve as the contract between modules. The AI should define them early and reference them everywhere.
