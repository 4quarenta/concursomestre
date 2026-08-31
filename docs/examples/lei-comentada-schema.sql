-- ConcursoMestre - Lei Comentada
-- Schema relacional base para PostgreSQL

create table legal_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  catalog_id text not null unique,
  name text not null,
  nome text not null,
  cor text not null default 'text-primary',
  icone text not null default 'BookOpen',
  total_leis integer not null default 0,
  description text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table laws (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references legal_areas(id),
  slug text not null unique,
  catalog_id text not null unique,
  sigla text not null,
  nome text not null,
  title text not null,
  short_title text not null,
  number text not null,
  numero text not null,
  ano text not null,
  descricao text not null default '',
  law_date date,
  aliases text[] not null default '{}',
  summary text not null default '',
  ementa text not null default '',
  status text not null default 'active',
  official_url text not null,
  url_planalto text not null,
  source_name text not null default 'Portal do Planalto',
  is_monitored boolean not null default true,
  total_artigos integer not null default 0,
  artigos_comentados integer not null default 0,
  last_synced_at timestamptz,
  last_updated_at timestamptz,
  access_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laws_status_check check (status in ('active', 'revoked', 'partially_revoked', 'monitoring'))
);

create index laws_area_idx on laws(area_id);
create index laws_number_idx on laws(number);
create index laws_access_idx on laws(access_count desc);
create index laws_last_updated_idx on laws(last_updated_at desc);
create index laws_search_idx on laws using gin (
  to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(short_title, '') || ' ' || coalesce(number, '') || ' ' || coalesce(summary, '') || ' ' || array_to_string(aliases, ' '))
);

create table law_versions (
  id uuid primary key default gen_random_uuid(),
  law_id uuid not null references laws(id) on delete cascade,
  version_hash text not null,
  official_url text not null,
  raw_html text,
  normalized_text text,
  captured_at timestamptz not null default now(),
  created_by uuid,
  unique (law_id, version_hash)
);

create table law_articles (
  id uuid primary key default gen_random_uuid(),
  law_id uuid not null references laws(id) on delete cascade,
  slug text not null,
  article_number text not null,
  numero text not null,
  title text,
  titulo text,
  texto text not null default '',
  paragrafos jsonb not null default '[]',
  macete text,
  questoes_relacionadas integer not null default 0,
  hierarchy jsonb not null default '{}',
  official_anchor text,
  current_hash text not null,
  is_revoked boolean not null default false,
  is_recently_changed boolean not null default false,
  changed_until timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (law_id, slug)
);

create index law_articles_law_idx on law_articles(law_id, display_order);
create index law_articles_number_idx on law_articles(article_number);
create index law_articles_changed_idx on law_articles(is_recently_changed, changed_until);
create index law_articles_search_idx on law_articles using gin (
  to_tsvector('portuguese', coalesce(article_number, '') || ' ' || coalesce(title, ''))
);

create table law_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  law_version_id uuid references law_versions(id) on delete set null,
  content_hash text not null,
  blocks jsonb not null,
  normalized_text text not null,
  change_type text not null default 'changed',
  captured_at timestamptz not null default now(),
  constraint law_article_versions_change_check check (change_type in ('created', 'changed', 'revoked', 'renumbered')),
  unique (article_id, content_hash)
);

create table teacher_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  autor text not null,
  cargo text not null default '',
  texto text not null,
  title text not null,
  body text not null,
  exam_focus text[] not null default '{}',
  pitfalls text[] not null default '{}',
  related_refs text[] not null default '{}',
  author_id uuid,
  author_name text not null,
  status text not null default 'published',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_comments_status_check check (status in ('draft', 'review', 'published', 'archived'))
);

create index teacher_comments_article_idx on teacher_comments(article_id);
create index teacher_comments_search_idx on teacher_comments using gin (
  to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || array_to_string(exam_focus, ' '))
);

create table article_jurisprudence (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  court text not null,
  precedent_type text not null,
  title text not null,
  summary text not null,
  exam_impact text not null default '',
  source_url text,
  is_consolidated boolean not null default false,
  priority text not null default 'medium',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_jurisprudence_priority_check check (priority in ('high', 'medium', 'low'))
);

create index article_jurisprudence_article_idx on article_jurisprudence(article_id);
create index article_jurisprudence_priority_idx on article_jurisprudence(priority, is_consolidated);

create table article_sumulas (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  tribunal text not null,
  numero text not null,
  texto text not null,
  vinculante boolean not null default false,
  created_at timestamptz not null default now()
);

create index article_sumulas_article_idx on article_sumulas(article_id);
create index article_sumulas_tribunal_idx on article_sumulas(tribunal, numero);

create table article_doutrina (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  texto text not null,
  autor text,
  obra text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index article_doutrina_article_idx on article_doutrina(article_id, display_order);

create table article_exam_tips (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  title text not null default 'Macete para prova',
  body text not null,
  tags text[] not null default '{}',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index article_exam_tips_article_idx on article_exam_tips(article_id);

create table user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint user_favorites_type_check check (target_type in ('law', 'article', 'jurisprudence', 'teacher_comment')),
  unique (user_id, target_type, target_id)
);

create index user_favorites_user_idx on user_favorites(user_id, created_at desc);

create table user_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references law_articles(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  status text not null default 'visible',
  reported_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_comments_status_check check (status in ('visible', 'hidden', 'reported', 'deleted'))
);

create index user_comments_article_idx on user_comments(article_id, created_at desc);
create index user_comments_user_idx on user_comments(user_id, created_at desc);
create index user_comments_status_idx on user_comments(status, reported_count desc);

create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  law_id uuid not null references laws(id) on delete cascade,
  viewed_article_ids uuid[] not null default '{}',
  last_article_id uuid references law_articles(id) on delete set null,
  progress_percent numeric(5,2) not null default 0,
  last_viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, law_id)
);

create index user_progress_user_idx on user_progress(user_id, last_viewed_at desc);
create index user_progress_law_idx on user_progress(law_id);

create table law_updates (
  id uuid primary key default gen_random_uuid(),
  law_id uuid not null references laws(id) on delete cascade,
  article_id uuid references law_articles(id) on delete set null,
  change_type text not null,
  title text not null,
  summary text not null,
  previous_text text,
  current_text text,
  source_url text not null,
  exam_impact text,
  changed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint law_updates_change_check check (change_type in ('created', 'changed', 'revoked', 'renumbered'))
);

create index law_updates_law_idx on law_updates(law_id, changed_at desc);
create index law_updates_article_idx on law_updates(article_id);
create index law_updates_changed_idx on law_updates(changed_at desc);

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  law_id uuid references laws(id) on delete set null,
  status text not null,
  source_url text,
  message text not null,
  inserted_articles integer not null default 0,
  changed_articles integer not null default 0,
  revoked_articles integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}',
  constraint sync_logs_status_check check (status in ('success', 'warning', 'failed', 'running'))
);

create index sync_logs_law_idx on sync_logs(law_id, started_at desc);
create index sync_logs_status_idx on sync_logs(status, started_at desc);

-- Extensões futuras já previstas
create table user_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  article_id uuid not null references law_articles(id) on delete cascade,
  block_id text not null,
  selected_text text not null,
  color text not null default 'yellow',
  created_at timestamptz not null default now()
);

create table user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  article_id uuid not null references law_articles(id) on delete cascade,
  body text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
