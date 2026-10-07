-- =============================================================================
-- Legal Delivery System — Supabase schema (tables, RLS, triggers, storage)
-- Run the whole file once in: Supabase Dashboard -> SQL Editor -> New query.
-- Safe to re-run: objects are created with IF NOT EXISTS / OR REPLACE where possible.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. USERS (profiles) — one row per person; `role` drives everything.
--    Couriers are pre-registered by the admin (row without auth_id); the row is
--    linked to their login automatically when they sign up with the same email.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  auth_id         uuid unique references auth.users(id) on delete set null,
  role            text not null default 'lawyer' check (role in ('admin', 'courier', 'lawyer')),
  full_name       text not null,
  email           text not null,
  phone           text,
  -- courier fields
  region          text,
  residence_city  text,
  address         text,
  license_number  text,
  business_type   text,
  -- law-firm fields (printed in the affidavit's attorney verification block)
  firm            text,
  bar_license_no  text,
  office_address  text,
  created_at      timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

-- Helpers used by the policies. SECURITY DEFINER so they can read `profiles`
-- without recursing into its own RLS.
create or replace function public.my_profile_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from public.profiles where auth_id = auth.uid() $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where auth_id = auth.uid() $$;

-- On sign-up: link to a pre-registered profile with the same email, otherwise
-- create a new LAWYER profile. (Admins/couriers can never self-assign a role.)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  update public.profiles set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null;
  if not found then
    insert into public.profiles (auth_id, role, full_name, email)
    values (new.id, 'lawyer',
            coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
            new.email);
  end if;
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (auth_id = auth.uid() or public.my_role() = 'admin');
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 2. ORDERS
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id          text primary key,
  status      text not null,
  city        text,
  lawyer_id   uuid references public.profiles(id),
  courier_id  uuid references public.profiles(id),
  data        jsonb not null default '{}'::jsonb,   -- recipient, address, pricing options, affidavit, ...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists orders_lawyer_idx on public.orders (lawyer_id);
create index if not exists orders_courier_idx on public.orders (courier_id);

alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (public.my_role() = 'admin'
         or lawyer_id  = public.my_profile_id()
         or courier_id = public.my_profile_id());

-- A lawyer may open new, unassigned orders in their own name; admin may insert anything.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (public.my_role() = 'admin'
              or (public.my_role() = 'lawyer'
                  and lawyer_id = public.my_profile_id()
                  and courier_id is null
                  and status = 'ממתין לשיוך'));

-- Admin updates everything; a courier updates only orders assigned to them
-- (and cannot hand them to someone else).
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (public.my_role() = 'admin'
         or (public.my_role() = 'courier' and courier_id = public.my_profile_id()))
  with check (public.my_role() = 'admin'
         or (public.my_role() = 'courier' and courier_id = public.my_profile_id()));

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated
  using (public.my_role() = 'admin');

-- Keeps updated_at fresh and stops non-admins from tampering with ownership,
-- the assigned courier's name or the agreed price override.
create or replace function public.protect_order_fields() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  new.updated_at := now();
  if public.my_role() is distinct from 'admin' then
    new.lawyer_id := old.lawyer_id;
    new.data := new.data || jsonb_build_object(
      'priceOverride',   coalesce(old.data->'priceOverride', 'null'::jsonb),
      'submittedBy',     coalesce(old.data->'submittedBy', 'null'::jsonb),
      'assignedCourier', coalesce(old.data->'assignedCourier', 'null'::jsonb),
      'lawyerId',        coalesce(old.data->'lawyerId', 'null'::jsonb)
    );
  end if;
  return new;
end
$$;
drop trigger if exists orders_protect on public.orders;
create trigger orders_protect before update on public.orders
  for each row execute function public.protect_order_fields();

-- -----------------------------------------------------------------------------
-- 3. VISITS — one IMMUTABLE row per field visit (no update/delete policies).
--    Media columns hold public Storage URLs, never base64.
-- -----------------------------------------------------------------------------
create table if not exists public.visits (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null references public.orders(id) on delete cascade,
  seq            int  not null,                      -- 1, 2, 3 (visit number)
  courier_id     uuid references public.profiles(id),
  data           jsonb not null default '{}'::jsonb, -- type, timestamp, GPS, notes
  photo_url      text,
  photo_meta     jsonb,                              -- {kind: image|video, timestamp, gps}
  audio_url      text,
  signature_url  text,                               -- recipient's signature (delivery)
  created_at     timestamptz not null default now(),
  unique (order_id, seq)
);
create index if not exists visits_order_idx on public.visits (order_id);

alter table public.visits enable row level security;

-- The sub-select on orders is itself filtered by orders' RLS, so a user sees
-- exactly the visits of the orders they can see.
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits for select to authenticated
  using (exists (select 1 from public.orders o where o.id = visits.order_id));

drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits for insert to authenticated
  with check (public.my_role() = 'admin'
              or (public.my_role() = 'courier'
                  and courier_id = public.my_profile_id()
                  and exists (select 1 from public.orders o
                               where o.id = visits.order_id
                                 and o.courier_id = public.my_profile_id())));

-- -----------------------------------------------------------------------------
-- 4. NOTIFICATIONS — created by triggers (clients cannot insert), read by the law firm
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,                  -- de-duplication key
  order_id    text references public.orders(id) on delete cascade,
  lawyer_id   uuid references public.profiles(id),
  kind        text not null,                         -- visit | completion
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_lawyer_idx on public.notifications (lawyer_id);

alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (public.my_role() = 'admin' or lawyer_id = public.my_profile_id());
drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications for update to authenticated
  using (lawyer_id = public.my_profile_id()) with check (lawyer_id = public.my_profile_id());
-- Clients may only flip the `read` flag.
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- Instant update for the law firm on every reported visit.
create or replace function public.notify_visit() returns trigger
language plpgsql security definer set search_path = public as
$$
declare o public.orders;
begin
  select * into o from public.orders where id = new.order_id;
  insert into public.notifications (key, order_id, lawyer_id, kind, message)
  values (new.order_id || '#v' || (new.seq - 1), new.order_id, o.lawyer_id, 'visit',
          'עדכון בזמן אמת: ביקור ' || new.seq || ' (' || coalesce(new.data->>'type', '') ||
          ') בוצע עבור מס'' משימה ' || new.order_id || ' — ' || coalesce(new.data->>'timestamp', ''))
  on conflict (key) do nothing;
  return new;
end
$$;
drop trigger if exists visits_notify on public.visits;
create trigger visits_notify after insert on public.visits
  for each row execute function public.notify_visit();

-- Completion notice once the courier's affidavit signature is saved.
create or replace function public.notify_completion() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if (new.data #>> '{affidavit,signature}') is not null
     and (old.data #>> '{affidavit,signature}') is null
     and new.status in ('נמסר', 'הדבקה', 'סירוב') then
    insert into public.notifications (key, order_id, lawyer_id, kind, message)
    values (new.id, new.id, new.lawyer_id, 'completion',
            case new.status
              when 'נמסר'  then 'הודעה: בוצעה מסירה בהצלחה עבור מס'' משימה ' || new.id
              when 'הדבקה' then 'הודעה: בוצעה הדבקה על הדלת (ביקור 3) עבור מס'' משימה ' || new.id
              else              'הודעה: תועד סירוב קבלה עבור מס'' משימה ' || new.id
            end)
    on conflict (key) do nothing;
  end if;
  return new;
end
$$;
drop trigger if exists orders_notify_completion on public.orders;
create trigger orders_notify_completion after update on public.orders
  for each row execute function public.notify_completion();

-- -----------------------------------------------------------------------------
-- 5. SETTINGS — pricing (everyone reads) and per-courier payroll documents
--    key 'pricing'            -> {"perAttempt":20,"perCompleted":60}
--    key 'payroll:<courierId>' -> paid flags + manual adjustments (admin + that courier)
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated
  using (public.my_role() = 'admin'
         or key = 'pricing'
         or key = 'payroll:' || public.my_profile_id()::text);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

insert into public.settings (key, value)
values ('pricing', '{"perAttempt":20,"perCompleted":60}')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 6. REALTIME — broadcast row changes (filtered per user by the RLS above)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['orders', 'visits', 'notifications', 'profiles', 'settings'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 7. STORAGE — public bucket `evidence` for photos, video, audio, signatures.
--    Files are written under "<orderId>/...", and only admin/couriers who can
--    see that order may upload. Files are never overwritten or deleted by clients.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do update set public = true;

drop policy if exists evidence_read on storage.objects;
create policy evidence_read on storage.objects for select
  using (bucket_id = 'evidence');

drop policy if exists evidence_upload on storage.objects;
create policy evidence_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence'
              and public.my_role() in ('admin', 'courier')
              and exists (select 1 from public.orders o where o.id = (storage.foldername(name))[1]));

-- =============================================================================
-- AFTER THE FIRST SIGN-UP: make yourself the admin (replace the email):
--   update public.profiles set role = 'admin' where lower(email) = lower('you@example.com');
-- =============================================================================
