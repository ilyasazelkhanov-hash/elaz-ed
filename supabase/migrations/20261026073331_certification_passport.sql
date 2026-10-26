begin;
create table public.ai_certifications (
 id text primary key check(id ~ '^[a-z0-9-]{1,100}$'),
 title text not null,
 provider text not null,
 topic text not null default 'fundamentals',
 credential text not null check(credential in ('certificate','badge')),
 credential_note text not null default '',
 free_course boolean,
 free_credential boolean,
 availability text not null default 'unverified' check(availability in ('reachable','restricted','unavailable','unverified')),
 checked_at timestamptz,
 url text not null check(url like 'https://%'),
 position integer not null default 0,
 published boolean not null default true,
 updated_at timestamptz not null default now()
);
create table public.certification_progress (
 user_id bigint not null references public.users(id) on delete cascade,
 certification_id text not null references public.ai_certifications(id) on delete cascade,
 status text not null default 'saved' check(status in ('saved','in_progress','completed','received')),
 updated_at timestamptz not null default now(),
 primary key(user_id,certification_id)
);
alter table public.ai_certifications enable row level security;
alter table public.certification_progress enable row level security;
revoke all on public.ai_certifications,public.certification_progress from public,anon,authenticated;
grant select,insert,update,delete on public.ai_certifications,public.certification_progress to service_role;
alter table public.advent_rewards drop constraint if exists advent_rewards_kind_check;
alter table public.advent_rewards add constraint advent_rewards_kind_check check(kind in ('promo','message','link','video','lesson','course','certification'));
commit;
