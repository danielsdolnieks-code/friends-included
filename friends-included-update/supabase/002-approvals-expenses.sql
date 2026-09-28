-- Run once after schema.sql. Preserves existing sales and Telegram links.
begin;
alter table public.sales alter column shares type numeric[] using shares::numeric[];
alter table public.sales
 add column approved_shares numeric[],
 add column decided_at timestamptz,
 add column source text not null default 'website',
 add column decision_status text not null default 'Not required',
 add column sync_error text,
 add constraint approved_sale_has_split check (status <> 'Approved' or (approved_shares is not null and array_length(approved_shares,1)=3 and approved_shares[1]>=0 and approved_shares[2]>=0 and approved_shares[3]>=0 and approved_shares[1]+approved_shares[2]+approved_shares[3]=100));
update public.sales set source='telegram' where telegram_update_id is not null;
create table public.expenses (
 id bigint generated always as identity primary key,
 reference text not null unique,
 submitted_at timestamptz not null default now(),
 employee text not null check (employee='kevin'),
 description text not null,
 amount_cents integer not null check (amount_cents>0),
 category text not null check(category in ('Materials','Travel','Other')),
 proposed_allocation text not null check(proposed_allocation in ('A','B','Company overhead')),
 final_allocation text check(final_allocation in ('A','B','Company overhead')),
 status text not null check(status in ('Awaiting allocation','Allocated')),
 source text not null check(source in ('telegram','website')),
 origin_chat_id text,
 telegram_update_id bigint unique,
 decided_at timestamptz,
 sync_status text not null default 'Sync pending',
 sync_error text,
 confirmation_status text not null default 'Not sent',
 decision_status text not null default 'Not required'
);
alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated;
create table public.transaction_references(reference text primary key);
alter table public.transaction_references enable row level security;
revoke all on public.transaction_references from anon, authenticated;
insert into public.transaction_references select reference from public.sales;
create function public.reserve_transaction_reference() returns trigger language plpgsql set search_path=public as $$
begin
 insert into public.transaction_references(reference) values(new.reference);
 return new;
end; $$;
create trigger reserve_sale_reference before insert on public.sales for each row execute function public.reserve_transaction_reference();
create trigger reserve_expense_reference before insert on public.expenses for each row execute function public.reserve_transaction_reference();
commit;
