-- RLS + ownership tests. Run after supabase_stub.sql and the migration.
\set ON_ERROR_STOP 1
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"display_name":"Asha"}'),
  ('22222222-2222-2222-2222-222222222222', '{}');

-- profile trigger
do $$ begin
  assert (select display_name from profiles where id='11111111-1111-1111-1111-111111111111') = 'Asha', 'profile trigger';
end $$;

set role authenticated;
-- ── user A creates data without sending user_id ──
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
insert into subjects (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Physics');
insert into chapters (id, subject_id, title) values ('aaaaaaaa-0000-0000-0000-0000000000c1','aaaaaaaa-0000-0000-0000-000000000001','Optics');
insert into notes (id, subject_id, title) values ('aaaaaaaa-0000-0000-0000-0000000000a1','aaaaaaaa-0000-0000-0000-000000000001','Lenses');
insert into assignments (subject_id, title, due_date) values ('aaaaaaaa-0000-0000-0000-000000000001','Lab report', now() + interval '1 day');

-- ── user B ──
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from subjects) = 0, 'B must not see A subjects';
  assert (select count(*) from notes) = 0, 'B must not see A notes';
end $$;

-- B cannot attach a note to A's subject even knowing the UUID
do $$ begin
  begin
    insert into notes (subject_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001','sneaky');
    raise exception 'FAIL: cross-user subject link allowed';
  exception when foreign_key_violation then null; end;
end $$;

-- B cannot spoof user_id
do $$ begin
  begin
    insert into subjects (user_id, name) values ('11111111-1111-1111-1111-111111111111','spoof');
    raise exception 'FAIL: spoofed user_id allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- B cannot update/delete A rows (silently affects 0 rows)
update subjects set name='hacked' where id='aaaaaaaa-0000-0000-0000-000000000001';
delete from notes where id='aaaaaaaa-0000-0000-0000-0000000000a1';

-- B cannot link exam_chapters to A's chapter
insert into exams (id, title, exam_date) values ('bbbbbbbb-0000-0000-0000-0000000000e1','Mock', now() + interval '7 days');
do $$ begin
  begin
    insert into exam_chapters (exam_id, chapter_id) values ('bbbbbbbb-0000-0000-0000-0000000000e1','aaaaaaaa-0000-0000-0000-0000000000c1');
    raise exception 'FAIL: cross-user chapter link allowed';
  exception when foreign_key_violation then null; end;
end $$;

-- B storage: cannot write into A's folder
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('attachments','11111111-1111-1111-1111-111111111111/x/y.pdf');
    raise exception 'FAIL: cross-user storage write';
  exception when insufficient_privilege then null; end;
end $$;

-- ── back to A: data intact, constraints behave ──
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select name from subjects where id='aaaaaaaa-0000-0000-0000-000000000001') = 'Physics', 'A subject intact';
  assert (select count(*) from notes) = 1, 'A note intact';
end $$;

-- user_id cannot be reassigned
do $$ begin
  begin
    update subjects set user_id='22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: user_id reassigned';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- completed_at is managed by the database trigger
update assignments set status='completed';
do $$ declare t1 timestamptz; begin
  select completed_at into t1 from assignments limit 1;
  assert t1 is not null, 'completed_at set on completion';
  perform pg_sleep(0.01);
  update assignments set title='Lab report v2';          -- editing keeps original completion time
  assert (select completed_at from assignments limit 1) = t1, 'completed_at preserved on edit';
  update assignments set completed_at = now() + interval '9 days';  -- client cannot forge it
  assert (select completed_at from assignments limit 1) = t1, 'completed_at not forgeable';
  update assignments set status='in_progress';
  assert (select completed_at from assignments limit 1) is null, 'cleared when reopened';
end $$;

-- new notes get a valid (non-empty) Tiptap document
insert into notes (title) values ('blank');
do $$ begin
  assert (select jsonb_array_length(content->'content') from notes where title='blank') = 1, 'default doc has a paragraph';
end $$;

-- deleting a subject nulls note.subject_id but keeps the note; cascades chapters
delete from subjects where id='aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from notes where title='Lenses' and subject_id is null) = 1, 'note kept, subject cleared';
  assert (select count(*) from chapters) = 0, 'chapters cascaded';
  assert (select user_id from notes where title='Lenses') = '11111111-1111-1111-1111-111111111111', 'note keeps owner';
end $$;

reset role;
select 'RLS_TESTS_PASSED' as result;
