-- Magic Drink: banco de dados no Supabase.
-- Rode este arquivo inteiro uma vez em SQL Editor > New query > Run.

-- 1. Tabela única de documentos (eventos, formatos, inscrições e mídias)
create table if not exists public.docs (
  path text primary key,
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists docs_collection_idx on public.docs (collection);

-- 2. Organizadores
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 3. Regras de acesso
alter table public.docs enable row level security;
alter table public.admins enable row level security;

drop policy if exists "todos leem eventos e formatos" on public.docs;
create policy "todos leem eventos e formatos" on public.docs for select
  using (path like 'events/%' or path like 'formats/%');

drop policy if exists "inscricoes: organizador ou o proprio jogador" on public.docs;
create policy "inscricoes: organizador ou o proprio jogador" on public.docs for select
  using (path like 'regs/%' and (public.is_admin() or path = 'regs/' || auth.uid()::text));

drop policy if exists "organizador altera tudo" on public.docs;
create policy "organizador altera tudo" on public.docs for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "jogador cria a propria inscricao" on public.docs;
create policy "jogador cria a propria inscricao" on public.docs for insert
  with check (path = 'regs/' || auth.uid()::text and collection = 'regs');

drop policy if exists "jogador altera a propria inscricao" on public.docs;
create policy "jogador altera a propria inscricao" on public.docs for update
  using (path = 'regs/' || auth.uid()::text)
  with check (path = 'regs/' || auth.uid()::text and collection = 'regs');

drop policy if exists "jogador apaga a propria inscricao" on public.docs;
create policy "jogador apaga a propria inscricao" on public.docs for delete
  using (path = 'regs/' || auth.uid()::text);

-- 4. Atualização ao vivo (mesas e resultados aparecem sem recarregar)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5. Fotos e vídeos: leitura pública, envio só do organizador
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "organizador envia midia" on storage.objects;
create policy "organizador envia midia" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "organizador apaga midia" on storage.objects;
create policy "organizador apaga midia" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- 6. Dados atuais do app (formatos e eventos)
insert into public.docs (path, collection, data) values
  ('formats/commander-casa', 'formats', $md${"banlist": "Lista oficial de banidas do Commander", "base": "commander", "bestOf": 1, "estrutura": "pods", "id": "commander-casa", "minutos": 75, "modo": "multi", "nome": "Commander da casa", "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "100 cartas singleton incluindo o comandante. 40 de vida. Dano de comandante 21.\nOrdem de turno definida pelos assentos sorteados na mesa.\nUm mulligan grátis; depois, mulligan de Londres.\nAo fim do tempo, o jogador ativo termina o turno e a partida é empate se não houver vencedor.\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('formats/draft-casa', 'formats', $md${"banlist": "", "base": "draft", "bestOf": 3, "estrutura": "draft", "id": "draft-casa", "minutos": 50, "modo": "1v1", "nome": "Booster Draft", "podSize": 8, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "Mínimo 40 cartas com terrenos básicos à vontade. 3 boosters por jogador.\nMesas de draft sorteadas; o pareamento é feito dentro de cada mesa.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('formats/duel-commander-500', 'formats', $md${"banlist": "Lista oficial de banidas do Duel Commander (incluindo a lista de banidos como comandante)", "base": "duelcommander", "bestOf": 3, "estrutura": "swiss", "id": "duel-commander-500", "minutos": 50, "modo": "1v1", "nome": "Duel Commander 500", "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "Deck de 100 cartas singleton incluindo o comandante. Sem sideboard.\nO valor total do deck, somando todas as cartas e o comandante, não pode passar de R$ 500, considerando o menor preço de cada carta na LigaMagic.\nPartidas 1 contra 1, 20 de vida.\nDano de comandante: 21.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('formats/duel-commander', 'formats', $md${"banlist": "Lista oficial de banidas do Duel Commander (incluindo a lista de banidos como comandante)", "base": "duelcommander", "bestOf": 3, "estrutura": "swiss", "id": "duel-commander", "minutos": 50, "modo": "1v1", "nome": "Duel Commander", "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "Deck de 100 cartas singleton incluindo o comandante. Sem sideboard.\nPartidas 1 contra 1, 20 de vida.\nDano de comandante: 21.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('formats/modern-casa', 'formats', $md${"banlist": "Lista oficial de banidas do Modern", "base": "modern", "bestOf": 3, "estrutura": "swiss", "id": "modern-casa", "minutos": 50, "modo": "1v1", "nome": "Modern da casa", "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "Mínimo 60 cartas, sideboard de até 15. Coleções a partir da Oitava Edição.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('formats/pauper-casa', 'formats', $md${"banlist": "Lista oficial de banidas do Pauper", "base": "pauper", "bestOf": 3, "estrutura": "swiss", "id": "pauper-casa", "minutos": 50, "modo": "1v1", "nome": "Pauper da casa", "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "regras": "Mínimo 60 cartas, apenas cartas impressas como comuns.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais."}$md$::jsonb),
  ('events/h2kc3n9v', 'events', $md${"banlist": "Lista oficial de banidas do Duel Commander (incluindo a lista de banidos como comandante)", "base": "duelcommander", "bestOf": 3, "cidade": "", "contato": "", "criadoEm": 1792211095781, "data": "2026-11-21", "descricao": "", "estrutura": "swiss", "formatoId": "duel-commander-500", "formatoNome": "Duel Commander 500", "hora": "14:00", "id": "h2kc3n9v", "local": "", "mana": ["b", "r"], "minutos": 50, "modo": "1v1", "mostrarDecks": true, "nome": "Magic Drink #6: Duel Commander 500", "players": [], "podSize": 4, "pontos": {"d": 0, "e": 1, "v": 3}, "premiacao": "", "regras": "Deck de 100 cartas singleton incluindo o comandante. Sem sideboard.\nO valor total do deck, somando todas as cartas e o comandante, não pode passar de R$ 500, considerando o menor preço de cada carta na LigaMagic.\nPartidas 1 contra 1, 20 de vida.\nDano de comandante: 21.\nPartidas em melhor de 3. O perdedor da partida anterior escolhe quem começa.\nAo fim do tempo, o jogador ativo termina o turno e são jogados mais 5 turnos (turno 0 + 5).\nAtrasos de mais de 10 minutos contam como derrota na rodada.\nDecisões de juiz da organização são finais.", "rodadas": 0, "rounds": [], "status": "inscricoes", "taxa": 70, "topCut": 0, "vagas": 32}$md$::jsonb)
on conflict (path) do nothing;
