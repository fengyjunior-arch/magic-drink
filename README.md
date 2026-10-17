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

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `index.html` | O app inteiro: telas, estilos e lógica da interface |
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
