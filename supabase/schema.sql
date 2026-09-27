create table public.telegram_links (
 telegram_user_id text primary key,
 chat_id text not null,
 employee text not null check (employee in ('richard','anastasia','jean-claude','kevin','svetlana'))
);
create table public.sales (
 id bigint generated always as identity primary key,
 reference text not null unique,
 submitted_at timestamptz not null default now(),
 employee text not null check (employee in ('richard','anastasia','jean-claude')),
 customer text not null,
 project text not null check (project in ('A','B')),
 description text not null,
 amount_cents integer not null check (amount_cents > 0),
 shares integer[] not null check (array_length(shares,1)=3 and shares[1]>=0 and shares[2]>=0 and shares[3]>=0 and shares[1]+shares[2]+shares[3]=100),
 status text not null default 'Pending approval',
 origin_chat_id text,
 telegram_update_id bigint unique,
 sync_status text not null default 'Sync pending',
 confirmation_status text not null default 'Not sent'
);
alter table public.telegram_links enable row level security;
alter table public.sales enable row level security;
revoke all on public.telegram_links, public.sales from anon, authenticated;
