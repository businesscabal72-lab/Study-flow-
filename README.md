# StudyFlow

A calm, Notion-inspired academic workspace for school and college students: subjects and chapters, a rich-text notes editor with PDF attachments, assignments (list / kanban / calendar), a study calendar with smart scheduling, an exam center with a revision planner, a timestamp-accurate focus timer, spaced-repetition flashcards, progress analytics and an AI study assistant — all backed by your own Supabase project.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn-style components on Radix · Lucide · Supabase (Postgres, Auth, Storage) · Gemini via a swappable provider layer · Recharts · Tiptap · TanStack Query · installable PWA.

---

## 1. Setup (about 10 minutes)

### Prerequisites
- Node.js 20.9+
- A Supabase project (free tier is fine)
- Optional: a Gemini API key from Google AI Studio (AI features show a clear "not configured" state without it)

### Steps

```bash
npm install
cp .env.example .env.local      # then fill in the values below
npm run dev                      # http://localhost:3000
```

1. **Database** — In the Supabase dashboard → SQL Editor, paste and run `supabase/migrations/0001_studyflow_schema.sql`. It creates all tables, indexes, constraints, triggers, Row Level Security policies and the private `attachments` storage bucket. (Or with the Supabase CLI: `supabase db push`.)
2. **Environment variables** (`.env.local`, and the same in Vercel → Project → Settings → Environment Variables):

   | Variable | Required | Where it's used |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Same page (anon / publishable key) |
   | `NEXT_PUBLIC_SITE_URL` | yes in production | Your deployed URL — used in auth email links |
   | `GEMINI_API_KEY` | for AI | Server-only. Never prefix with `NEXT_PUBLIC_` |
   | `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
   | `AI_PROVIDER` | no | Defaults to `gemini` |
   | `AI_HOURLY_LIMIT` / `AI_DAILY_LIMIT` | no | Per-user AI request caps (defaults 40 / 200) |
   | `SUPABASE_SERVICE_ROLE_KEY` | no | Server-only. Enables "Delete account" in Settings |

3. **Auth redirect URLs** — Supabase → Authentication → URL Configuration:
   - Site URL: your app URL (e.g. `http://localhost:3000`)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`

   Email confirmation can be on or off; signup handles both.

If the Supabase variables are missing, every route shows a `/setup` page explaining what to configure instead of crashing or pretending to be connected.

### Deploy to Vercel
Import the repo, add the environment variables above, deploy. No extra configuration is needed.

---

## 2. What's included

| Area | Highlights |
|---|---|
| **Auth & onboarding** | Sign up, log in, log out, forgot/reset password, protected routes (Next 16 `proxy.ts`), 4-step onboarding (name → subjects → study preferences → study days) with skip options |
| **Dashboard** | Time-based greeting, today's overview, today's schedule with completion, priority tasks, subjects with progress, weekly study chart, upcoming events, quick actions, empty states for new users — all from the database |
| **Subjects** | CRUD with colors and teacher; detail tabs for Overview, Chapters (4 statuses, reorder, rename), Notes, Assignments, Resources (links + PDFs from notes) |
| **Notes** | Tiptap editor: headings, lists, checklists, tables, code blocks, quotes; debounced autosave with status + retry; subject filing, tags, pinning, search; private PDF attachments (10 MB) |
| **Assignments** | List / Kanban (drag-and-drop on desktop, status picker on touch) / Calendar; filter, sort, overdue highlighting; overdue items are never auto-completed |
| **Schedule** | Day / week / month views; tap a slot to add; mark complete; **Suggest study blocks** proposes sessions from deadlines, exams and availability — always shown as editable suggestions before saving |
| **Exam Center** | Exams with syllabus chapters, days remaining, completion and revision counts, preparation status; **Plan revision** spreads unfinished chapters (needs-revision first) across free time and reports what didn't fit. No grade predictions |
| **Focus Room** | 25-min default, custom durations, short/long breaks (every 4th), subject tagging; remaining time derived from timestamps so it survives tab switches, backgrounding and reloads; idempotent saves; mini timer in the header on every page |
| **Flashcards** | Manual cards, AI generation from a note (review before saving), flip animation, Easy/Medium/Difficult with interval previews, SM-2-style scheduling, review history |
| **AI Assistant** | Streaming chat with history, new conversation, suggested prompts, attach up to 3 notes as context, stop/retry, clear errors. Note actions: summarize, explain, key points, flashcards, practice questions |
| **Progress** | Focus hours, completed assignments/sessions, flashcards reviewed, streak; weekly study time, subject distribution, assignment completion, consistency, subject progress, revision activity — computed from real rows |
| **Settings** | Profile, light/dark/system theme, notification preferences + browser permission, study preferences, change password, delete all data, delete account |
| **PWA** | Manifest, icons (incl. maskable), service worker caching the static app shell, offline fallback page, offline banner. Data and AI honestly require a connection |

---

## 3. Security model

- **RLS on every table.** Policies restrict select/insert/update/delete to `user_id = auth.uid()`.
- **`user_id` is never sent by the browser.** It defaults to `auth.uid()` in the database; a trigger blocks changing it after insert.
- **Ownership of related records is enforced by the database.** Composite foreign keys `(subject_id, user_id) → subjects(id, user_id)` mean a user cannot attach a note, assignment, exam chapter or flashcard to someone else's subject/exam/chapter even if they know its UUID.
- **Storage** objects live under `<user_id>/…` with policies matching the folder to the caller.
- **AI keys are server-only.** All AI calls go through `/api/ai/*` route handlers that verify the session with `auth.getUser()`, validate input with zod, enforce per-user hourly/daily limits (recorded in `ai_usage`), and cap message/context size.
- **AI behaviour:** age-appropriate, explanation-first (won't just hand over graded work), never claims to have read PDFs or files it wasn't given — only note *text* is sent.

---

## 4. Project structure

```
app/
  (auth)/login, signup, forgot-password   reset-password/   auth/{callback,confirm,signout}
  (app)/dashboard, schedule, subjects/[id], notes, assignments, exams, ai, focus,
        flashcards, progress, settings      ← authenticated shell + loading/error boundaries
  onboarding/   setup/   offline/   api/ai/{chat,note,flashcards,status}   api/account/delete
  manifest.ts   layout.tsx   globals.css (design tokens, light + dark)
components/   ui/ (button, dialog, tabs, …)  layout/  dashboard/  notes/  calendar/  assignments/
              subjects/  schedule/  exams/  focus/  flashcards/  ai/  progress/  settings/  common/
hooks/        use-data (TanStack Query), use-mutation, use-autosave, use-focus-timer, use-session
lib/
  supabase/   browser + server clients, session proxy, env guard
  data/       all database access (UI never calls Supabase directly for CRUD)
  logic/      pure business logic: srs, scheduler, timer, analytics, notifications
  ai/         provider interface, Gemini implementation, prompts, route guard
  validations/ zod schemas      utils/ formatting, colors
supabase/migrations/   types/database.ts   public/ (sw.js, icons, offline.html)   tests/
```

**Swapping AI providers:** implement `AIProvider` (`lib/ai/provider.ts`) and register it in `lib/ai/index.ts`. Routes never import a vendor SDK.

---

## 5. Verification status — please read

This codebase was written in a sandbox **without access to the npm registry**, so `npm install`, `next build` and a running browser session were not possible there. What *was* verified:

- ✅ **Database:** the migration runs cleanly on PostgreSQL 16 against a mock of Supabase's `auth`/`storage` schemas, and `tests/sql/rls_test.sql` passes — cross-user reads, spoofed `user_id`, cross-user foreign-key links and cross-user storage writes are all rejected; cascades, completion-time trigger and defaults behave correctly.
- ✅ **Core logic:** `npm test` — 10 unit tests covering spaced repetition, free-slot finding, study-block suggestions, the revision planner, the timestamp-based timer (including throttled/backgrounded tabs), and analytics.
- ✅ **TypeScript:** the whole project type-checks under `strict` against stub declarations for third-party packages (catching syntax errors, broken imports/exports, and our own type mismatches — two real bugs were found and fixed this way).
- ✅ **Tailwind:** `globals.css` compiles with Tailwind v4 and all custom tokens resolve.
- ⚠️ **Not yet verified:** a real `next build`, and exact API compatibility with the newest versions of Tiptap v3, `radix-ui`, `@google/genai`, zod v4 and Next 16. These were written to their documented current APIs, but versions in `package.json` are ranges.

**First run checklist:** `npm install && npm run typecheck && npm test && npm run build`. If anything fails, it will most likely be a small import/API difference in one of the packages above — the error message will point at the exact file.

To re-run the SQL tests locally with Postgres 15+:
```bash
createdb sf_test
psql -d sf_test -f tests/sql/supabase_stub.sql -f supabase/migrations/0001_studyflow_schema.sql -f tests/sql/rls_test.sql
```

---

## 6. Notes & limits

- **Study time** = completed focus sessions + completed planned sessions. If you run the focus timer *during* a planned session and also tick the session, both count.
- **Notifications** are in-app reminders derived from your data, plus a system notification when a focus timer ends. There are no scheduled push notifications (that needs a push service).
- **Offline:** the app shell and static assets are cached so the app opens fast and shows a clear offline page; reading or saving data offline is not supported.
- **Demo data:** none is seeded. The authenticated app only ever shows your real records.
