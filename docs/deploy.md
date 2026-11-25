# Deploy: MongoDB Atlas + Vercel

O app roda na Vercel (funções serverless em Node.js) e usa um cluster do MongoDB Atlas como banco. As variáveis de ambiente estão descritas em [`.env.example`](../.env.example).

## 1. Banco no MongoDB Atlas

Escolha **um** dos caminhos.

### Opção A — pela integração da Vercel (recomendado)
1. Crie o projeto na Vercel primeiro (passo 2).
2. Vercel › Project › **Storage** › **Create Database** › **MongoDB Atlas**.
3. Escolha o plano gratuito (M0) e a região **São Paulo (sa-east-1)** ou a mais próxima das suas funções.
4. A integração cria o cluster, libera o acesso da Vercel e grava `MONGODB_URI` no projeto.
5. Confira se a URI tem o nome do banco antes do `?` (`…mongodb.net/project-flow?…`). Sem isso o Mongo usa o banco `test`.

### Opção B — direto no Atlas
1. [cloud.mongodb.com](https://cloud.mongodb.com) › **Create** › cluster **M0** › região `sa-east-1`.
2. **Database Access** › usuário com senha forte e papel `readWrite` no banco `project-flow`.
3. **Network Access** › **Add IP Address** › `0.0.0.0/0`. As funções da Vercel não têm IP fixo; a proteção fica no usuário e na senha.
4. **Connect** › **Drivers** › copie a URI, troque `<password>` e acrescente `/project-flow` antes do `?`.

> O cluster do Atlas é um replica set, então as transações usadas em `deleteProjectAction` funcionam lá (num Mongo local avulso, não).

## 2. Projeto na Vercel
1. [vercel.com/new](https://vercel.com/new) › importe o repositório do GitHub. O framework é detectado como Next.js; não mude o comando de build.
2. **Settings › Environment Variables** — cadastre para *Production* e *Preview*:

| Variável | Valor |
|---|---|
| `MONGODB_URI` | URI do Atlas (a integração preenche sozinha) |
| `NEXTAUTH_SECRET` | `npx auth secret` ou `openssl rand -base64 32` |
| `NEXTAUTH_URL` | só em *Production*: `https://SEU-DOMINIO` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | credenciais OAuth do Google |
| `GITHUB_ID` / `GITHUB_SECRET` | OAuth App do GitHub |

3. **Settings › Functions › Function Region**: a mesma região do cluster (`gru1` — São Paulo — para `sa-east-1`). Banco e função longe um do outro somam latência em cada consulta.
4. Faça o deploy. O build precisa de `MONGODB_URI` definida, porque `lib/db.ts` verifica a variável ao carregar.

## 3. URLs de retorno do OAuth
Depois que o domínio de produção existir, cadastre:
- **Google** (Credenciais › ID do cliente) — URI de redirecionamento: `https://SEU-DOMINIO/api/auth/callback/google`
- **GitHub** (OAuth App) — Authorization callback URL: `https://SEU-DOMINIO/api/auth/callback/github`

Deploys de *Preview* têm URL diferente a cada branch, então o login por Google/GitHub só funciona no domínio de produção. Login por e-mail e senha funciona em todos.

## 4. Conferir
- Abra `https://SEU-DOMINIO/auth/signup`, crie uma conta e um workspace.
- No Atlas › **Browse Collections**, o banco `project-flow` deve ter `users`, `workspaces` e, depois de criar um projeto e uma tarefa, `projects`, `tasks` e `changehistories`.
- Erros de conexão aparecem em Vercel › Project › **Logs**. `MongooseServerSelectionError` quase sempre é IP não liberado no Atlas ou senha errada na URI.
