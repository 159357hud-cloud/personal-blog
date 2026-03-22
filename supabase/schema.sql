create table if not exists public.site_content (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 1)
);

create table if not exists public.posts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists posts_updated_at_idx on public.posts (updated_at desc);
