-- ═══════════════════════════════════════════════════════════════════════
-- StudyFlow schema
-- Every user-owned table:
--   • user_id defaults to auth.uid() — the browser never needs to send it
--   • RLS restricts all access to the owner
--   • related records use COMPOSITE foreign keys (x_id, user_id) so a user
--     can never attach their record to someone else's subject/exam/note,
--     even if they guess a UUID. Ownership is enforced by the database.
-- Requires Postgres 15+ (column-list ON DELETE SET NULL). Supabase is 15+.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Helpers ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── profiles ───────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  onboarded boolean not null default false,
  -- study preferences
  study_days smallint[] not null default '{1,2,3,4,5}'
    check (study_days <@ '{0,1,2,3,4,5,6}'::smallint[]),       -- 0 = Sunday
  study_window_start time not null default '16:00',
  study_window_end time not null default '21:00',
  session_minutes smallint not null default 45 check (session_minutes between 15 and 240),
  daily_goal_minutes smallint not null default 120 check (daily_goal_minutes between 0 and 960),
  focus_minutes smallint not null default 25 check (focus_minutes between 1 and 180),
  short_break_minutes smallint not null default 5 check (short_break_minutes between 1 and 60),
  long_break_minutes smallint not null default 15 check (long_break_minutes between 1 and 90),
  notification_prefs jsonb not null default
    '{"due_today": true, "overdue": true, "exams": true, "flashcards": true, "focus_complete": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (study_window_end > study_window_start)
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── subjects ───────────────────────────────────────────────────────────
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  teacher_name text check (char_length(teacher_name) <= 80),
  color text not null default 'sage' check (color in ('sage','lavender','sand','sky','rose','slate','amber','teal')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index subjects_user_idx on public.subjects (user_id, created_at);

-- ── chapters ───────────────────────────────────────────────────────────
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'not_started'
    check (status in ('not_started','learning','completed','needs_revision')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index chapters_subject_idx on public.chapters (subject_id, position);
create index chapters_user_idx on public.chapters (user_id);

-- ── notes ──────────────────────────────────────────────────────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null default 'Untitled' check (char_length(title) <= 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,   -- Tiptap JSON
  content_text text not null default '',                                -- plain text for search + AI
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
create index notes_user_updated_idx on public.notes (user_id, is_pinned desc, updated_at desc);
create index notes_subject_idx on public.notes (subject_id);
create index notes_tags_idx on public.notes using gin (tags);
create index notes_search_idx on public.notes
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_text,'')));

-- ── note attachments (PDFs in Supabase Storage) ────────────────────────
create table public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null unique,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  mime_type text not null check (mime_type = 'application/pdf'),
  created_at timestamptz not null default now(),
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete cascade,
  -- path must live under the owner's folder
  check (storage_path like (user_id::text || '/%'))
);
create index note_attachments_note_idx on public.note_attachments (note_id);

-- ── subject resources (links) ──────────────────────────────────────────
create table public.subject_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index subject_resources_subject_idx on public.subject_resources (subject_id);

-- ── assignments ────────────────────────────────────────────────────────
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 4000),
  due_date timestamptz not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  check ((status = 'completed') = (completed_at is not null))
);
-- completed_at is managed by the database: set when an assignment becomes
-- completed, kept while it stays completed, cleared if reopened.
create or replace function public.assignment_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at = now();
    else
      new.completed_at = old.completed_at;
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end $$;
create trigger assignments_completion before insert or update on public.assignments
  for each row execute function public.assignment_completion();

create index assignments_user_due_idx on public.assignments (user_id, status, due_date);
create index assignments_subject_idx on public.assignments (subject_id);

-- ── study sessions (planned calendar blocks) ───────────────────────────
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  check (end_time > start_time),
  check (end_time - start_time <= interval '12 hours')
);
create index study_sessions_user_time_idx on public.study_sessions (user_id, start_time);

-- ── exams ──────────────────────────────────────────────────────────────
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  exam_date timestamptz not null,
  exam_type text not null default 'unit_test'
    check (exam_type in ('quiz','unit_test','midterm','final','practical','oral','other')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create index exams_user_date_idx on public.exams (user_id, exam_date);

create table public.exam_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id uuid not null,
  chapter_id uuid not null,
  revision_status text not null default 'not_started'
    check (revision_status in ('not_started','learning','completed','needs_revision')),
  created_at timestamptz not null default now(),
  unique (exam_id, chapter_id),
  foreign key (exam_id, user_id) references public.exams (id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete cascade
);
create index exam_chapters_exam_idx on public.exam_chapters (exam_id);

-- ── focus sessions (completed timers) ──────────────────────────────────
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  client_id uuid unique,                                -- idempotency key from the timer
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  check (completed_at > started_at)
);
create index focus_sessions_user_idx on public.focus_sessions (user_id, completed_at desc);

-- ── flashcards + review history ────────────────────────────────────────
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  note_id uuid,
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null check (char_length(answer) between 1 and 3000),
  difficulty text check (difficulty in ('easy','medium','difficult')),   -- last rating
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor >= 1.30),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete set null (note_id)
);
create index flashcards_user_due_idx on public.flashcards (user_id, next_review_at);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  flashcard_id uuid not null,
  rating text not null check (rating in ('easy','medium','difficult')),
  interval_days integer not null,
  reviewed_at timestamptz not null default now(),
  foreign key (flashcard_id, user_id) references public.flashcards (id, user_id) on delete cascade
);
create index flashcard_reviews_user_idx on public.flashcard_reviews (user_id, reviewed_at desc);

-- ── AI conversations ───────────────────────────────────────────────────
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 40000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.ai_conversations (id, user_id) on delete cascade
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

-- AI usage ledger for rate limiting (written server-side only)
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null check (char_length(feature) <= 40),
  created_at timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
create policy "profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'subjects','chapters','notes','note_attachments','subject_resources','assignments',
    'study_sessions','exams','exam_chapters','focus_sessions','flashcards','flashcard_reviews',
    'ai_conversations','ai_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: select own" on public.%1$I for select using (user_id = auth.uid())', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ai_usage: users may read and append their own usage; never edit/delete it
alter table public.ai_usage enable row level security;
create policy "ai_usage: select own" on public.ai_usage for select using (user_id = auth.uid());
create policy "ai_usage: insert own" on public.ai_usage for insert with check (user_id = auth.uid());

-- Prevent user_id from being changed after insert (defence in depth)
create or replace function public.lock_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'subjects','chapters','notes','note_attachments','subject_resources','assignments',
    'study_sessions','exams','exam_chapters','focus_sessions','flashcards','flashcard_reviews',
    'ai_conversations','ai_messages'
  ] loop
    execute format('create trigger %1$s_lock_user before update on public.%1$I for each row execute function public.lock_user_id()', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Storage: private bucket for note PDFs. Objects live at <user_id>/<note_id>/<file>
-- ═══════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "attachments: read own" on storage.objects for select
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments: upload own" on storage.objects for insert
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments: delete own" on storage.objects for delete
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
