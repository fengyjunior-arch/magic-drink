# Magic Drink

Site dos torneios Magic Drink de Magic: The Gathering. Os jogadores veem os eventos, as regras, as mesas ao vivo e a classificação, e se inscrevem sem precisar criar conta. O organizador entra com e-mail e senha para criar eventos, gerar rodadas, lançar resultados, enviar fotos e vídeos e gerar o flyer de divulgação.

O site é feito só de arquivos estáticos e fica no GitHub Pages. Os dados ficam no Supabase, no plano gratuito.

## Como colocar no ar

### 1. Supabase (banco de dados, login e fotos)

1. Crie uma conta em https://supabase.com e clique em **New project**. Escolha a região **South America (São Paulo)**.
2. Em **SQL Editor > New query**, cole todo o conteúdo de `supabase/setup.sql` e clique em **Run**.
3. Em **Authentication > Sign In / Providers**, ative **Allow anonymous sign-ins**. É isso que permite aos jogadores se inscreverem sem criar conta.
4. Em **Authentication > Users > Add user > Create new user**, crie o usuário do organizador (seu e-mail e uma senha) e marque **Auto Confirm User**.
5. Volte ao **SQL Editor** e rode, trocando pelo seu e-mail:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'seu-email@exemplo.com';
   ```

6. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**, e cole as duas em `config.js`.

### 2. GitHub Pages (o site)

1. No repositório, vá em **Settings > Pages**.
2. Em **Source**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`. Clique em **Save**.
3. Em um ou dois minutos, o site fica disponível no endereço mostrado na mesma página (algo como `https://seu-usuario.github.io/magic-drink/`).

### 3. Primeiro acesso

Abra o site, clique em **Organizador** e entre com o e-mail e a senha do passo 1.4. Os formatos e o evento que já existiam no app antigo foram copiados pelo `setup.sql`.

## No dia do evento

- **Check-in**: na aba Jogadores, clique em **Abrir check-in** e deixe o QR code na entrada. Quem chega lê o código e confirma presença. Antes da 1ª rodada, tire dos pareamentos quem não fez check-in.
- **Resultados**: cada jogador informa o resultado da própria mesa pelo celular. Quando os dois lados informam o mesmo resultado (ou só um informou), aparece o botão para confirmar. Se informarem resultados diferentes, a mesa fica marcada para você decidir.
- **Pix**: preencha a chave Pix no evento. O jogador inscrito vê o QR code com o valor da inscrição e avisa quando pagou; você confirma na coluna Pago.
- **Lista do deck**: em Configurar, marque "Pedir a lista do deck" e, para Duel Commander 500, o valor máximo. A inscrição pede a lista e o valor total pela LigaMagic e recusa valores acima do limite.
- **Ranking**: soma os pontos de todos os eventos já realizados. Cada evento pode ficar fora do ranking em Configurar.
- **Telão**: na aba Rodadas, clique em **Abrir telão** e deixe a página aberta numa TV. Ela mostra o QR code do check-in, as mesas, o relógio e a classificação, e se atualiza sozinha.
- **Mesas no WhatsApp**: na aba Rodadas, **Copiar mesas** ou **Enviar no WhatsApp** monta a mensagem da rodada para o grupo.
- **Perfil do jogador**: no Ranking, toque no nome do jogador para ver o histórico dele.
- **Lista de espera**: quando as vagas acabam, quem entra fica na lista de espera e fora dos pareamentos. Se alguém desistir antes da 1ª rodada, o primeiro da fila entra sozinho.
- **Emblemas e Elixir**: em Configurar, escolha o sorteio de emblemas (um por jogador no evento todo, ou um novo a cada rodada). O emblema aparece no check-in e na mesa do jogador, que marca no celular as habilidades que usou. A 1ª habilidade da partida custa 1 dose, a 2ª custa 2 e a 3ª custa 3. O total vai para a classificação e o telão quando a organização está com o site aberto.
- **Elixir pela organização**: na aba Rodadas, abra "Elixir" embaixo de cada mesa para marcar ou corrigir as habilidades de cada jogador. A marcação da organização vale mais que a do jogador.
- **Aviso de nova rodada**: quem está inscrito e com o site aberto recebe um aviso (e o celular vibra) quando sai a mesa dele. O botão "Avisar no celular quando sair minha mesa" libera as notificações.
- **Relatório do meta**: no menu, "Meta" mostra os decks e comandantes mais jogados, com títulos e aproveitamento, somando todos os eventos. Para o público, entram só os eventos com "Mostrar os decks" ligado.
- **Agenda**: na página do evento, "Salvar na agenda do celular" baixa um arquivo .ics e "Google Agenda" abre o evento já preenchido.
- **Conquistas**: o perfil do jogador mostra selos como Campeão, Pódio, Invicto, Veterano e Copo sem fundo.

## Instalar como app

O site pode ser instalado no celular e abre em tela cheia, com o ícone do Magic Drink. No Android (Chrome), aparece o botão **Instalar** na página inicial. No iPhone, abra o site no Safari, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**. O app sempre busca a versão mais nova do site. Sem internet, ele abre a última versão guardada.

## Cópia de segurança

Em **Organizar**, **Baixar cópia** salva todos os eventos, formatos, inscrições e a lista de fotos e vídeos num arquivo `.json`. **Restaurar cópia** devolve esses dados ao site: substitui os itens com o mesmo nome e não apaga o que não está na cópia. Os arquivos de foto e vídeo ficam no Supabase e não vão para a cópia.

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `index.html` | O app inteiro: telas, estilos e lógica da interface |
| `manifest.webmanifest`, `sw.js`, `icons/` | Deixam o site ser instalado como app no celular |
| `qrcode.js` | Gerador de QR code (biblioteca qrcode-generator, licença MIT) |
| `engine.js` | Pareamentos e chaves: suíço, eliminatória simples e dupla, todos contra todos, pods de Commander e de draft, classificação com desempates |
| `backend.js` | Ligação com o Supabase: dados, login, fotos e vídeos, e salvar o flyer |
| `config.js` | Endereço e chave pública do seu projeto Supabase |
| `supabase/setup.sql` | Tabelas, regras de acesso, armazenamento de mídia e dados iniciais |

## Quem pode fazer o quê

- **Qualquer pessoa**: vê eventos, formatos, regras, mesas, classificação, fotos e vídeos.
- **Jogador (sessão anônima automática)**: se inscreve e cancela a própria inscrição. O contato informado só é visto pela organização.
- **Organizador (usuários da tabela `admins`)**: faz todo o resto.

Para adicionar outro organizador, crie o usuário dele no Supabase e rode o comando do passo 1.5 com o e-mail dele.

Sem `config.js` preenchido, o site abre em modo local, e os dados ficam só no navegador. Isso é útil para testar.
