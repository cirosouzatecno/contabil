create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80)
);

alter table public.perfis enable row level security;
revoke all on public.perfis from anon, authenticated;
grant select, insert, update on public.perfis to authenticated;

create policy "Usuário lê o próprio perfil" on public.perfis for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Usuário cria o próprio perfil" on public.perfis for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Usuário edita o próprio perfil" on public.perfis for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
