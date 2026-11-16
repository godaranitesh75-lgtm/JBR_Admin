-- Upgrade an existing catalog to the image_data field used by the API.
-- Safe to run more than once; existing image values are preserved.
do $$
begin
  if to_regclass('public.products') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'image_url'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'image_data'
    ) then
      alter table public.products rename column image_url to image_data;
    elsif not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'image_data'
    ) then
      alter table public.products add column image_data text not null default '';
    end if;

    comment on column public.products.image_data is
      'Product image URL or data URL used by the catalog API';
  end if;
end $$;
