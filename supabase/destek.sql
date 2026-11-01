-- Destek kutusu tablosu. Supabase > SQL Editor'e yapıştırıp çalıştır.
create table if not exists public.destek (
  id bigint generated always as identity primary key,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  email text not null check (length(email) between 5 and 120),
  message text not null check (length(message) between 10 and 500),
  status text not null default 'yeni',
  created_at timestamptz not null default now()
);

alter table public.destek enable row level security;

-- Herkes mesaj YAZABİLİR, kimse OKUYAMAZ (sen panelden okursun).
drop policy if exists destek_yaz on public.destek;
create policy destek_yaz on public.destek for insert to anon, authenticated
  with check (status = 'yeni');

-- Sunucu tarafı spam freni: son 1 saatte 30'dan fazla mesaj gelirse yenisi reddedilir,
-- aynı kullanıcı adından 1 saatte en fazla 3 mesaj kabul edilir.
create or replace function public.destek_fren() returns trigger language plpgsql security definer as $$
begin
  if (select count(*) from public.destek where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'cok_fazla_mesaj';
  end if;
  if (select count(*) from public.destek where username = new.username and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'cok_fazla_mesaj';
  end if;
  return new;
end $$;

drop trigger if exists destek_fren on public.destek;
create trigger destek_fren before insert on public.destek for each row execute function public.destek_fren();
