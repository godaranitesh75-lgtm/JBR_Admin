create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  sku text not null default '',
  category text not null check (length(trim(category)) between 1 and 60),
  description text not null default '',
  price numeric(12, 2) not null default 0 check (price between 0 and 9999999999),
  stock integer not null default 0 check (stock between 0 and 1000000000),
  image_data text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key,
  phone text not null,
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.admin_credentials (
  id integer primary key check (id = 1),
  username text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_credentials (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_sessions (
  id uuid primary key,
  customer_id uuid not null references customer_credentials(id),
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists products_active_name_idx
  on public.products (active, name);

create index if not exists products_updated_at_idx
  on public.products (updated_at desc);

create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_product_updated_at();
