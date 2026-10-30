# Fusaha — Developer Documentation

Fusaha is an AI-powered lesson authoring platform for teaching **Arabic to non-native
speakers**. A teacher uploads a lesson source (images, typed text, or a PDF/DOCX),
picks a level, and an AI pipeline generates a complete interactive lesson. The teacher
reviews and edits the draft, approves it, then runs it fullscreen in the classroom or
shares it through an anonymous link.

Guiding principle (PRD §1.3): *the teacher sees a simple educational platform; all the
real complexity stays inside the system.*

## Documentation index

| Document | What it covers |
|---|---|
| [architecture.md](./architecture.md) | System overview, request lifecycle, repository layout, coding conventions |
| [tech-stack.md](./tech-stack.md) | Every library and service used, and why |
| [frontend.md](./frontend.md) | Route map, component library, styling, the official locale/RTL/LTR standard, form and data-flow patterns |
| [api-reference.md](./api-reference.md) | **The service catalogue.** Every Server Action and HTTP route: inputs, outputs, auth, side effects |
| [data-model.md](./data-model.md) | Database schema: every table, column, relation, and enum |
| [ai-pipeline.md](./ai-pipeline.md) | Lesson generation end to end, source ingestion, templates, billing, integrations |
| [development.md](./development.md) | Local setup, environment variables, migrations, deployment, known issues |
| [PRD.md](./PRD.md) | Original product requirements document (draft v1) |
| [product/VISION.md](./product/VISION.md) | Strategic vision and product principles |
| [product/BOOK_LIBRARY_SPECIFICATION.md](./product/BOOK_LIBRARY_SPECIFICATION.md) | Organizational standard for adding, classifying, and linking books and references (not an implemented feature) |
| [architecture/REPOSITORY_TREE.md](./architecture/REPOSITORY_TREE.md) | Verified repository directory tree and major code groups |
| [architecture/SYSTEM_ARCHITECTURE_MAP.md](./architecture/SYSTEM_ARCHITECTURE_MAP.md) | Selective map of current runtime, domain, and integration boundaries |
| [architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md](./architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md) | Target architecture for immutable shared template runtimes, lesson-version references, lifecycle, security, and migration |

## Read this first

This project has **no REST API**. It is a Next.js App Router application where all
mutations run as **React Server Actions** (typed function calls, invoked over an
internal RPC channel that Next.js manages) and all reads happen inside Server
Components. There are therefore no public endpoints to collect in a Postman file.

[api-reference.md](./api-reference.md) is the direct equivalent: it documents every
action exactly as an endpoint would be documented — name, input shape, validation
rules, authorization, return values, and side effects. Three genuine HTTP route
handlers do exist (Paddle webhook, auth callback, lesson player frames) and are
documented there too.

## The 60-second tour

- **Users** are teachers, admins, and custom staff roles ("employees"). Anonymous
  visitors can open a shared lesson link.
- **Teachers** spend **credits** to generate lessons. Credits are bought through
  **Paddle** or granted by an admin.
- **Admins** define **levels** (`schema_definitions` — the AI instruction/prompt) and
  **templates** (the HTML player, a few-shot blueprint, and a validation script).
- **Generation** runs asynchronously on **Trigger.dev** because it exceeds serverless
  request timeouts. The UI polls for completion.
- **Lessons** are versioned. Editing produces drafts; approving freezes a version and
  makes it the one that plays and shares.
