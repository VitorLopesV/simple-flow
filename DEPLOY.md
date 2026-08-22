# Deploy na Vercel

Dois projetos Vercel separados, apontando para o mesmo repositório GitHub
(`VitorLopesV/simple-flow`), cada um com um Root Directory diferente. Siga nesta ordem: backend
primeiro (para ter a URL real), depois frontend, depois ajuste o CORS.

## J1 — Projeto do backend

1. https://vercel.com/new → **Import Git Repository** → selecione `VitorLopesV/simple-flow`.
2. Em **Configure Project**:
   - **Project Name**: `simple-flow-backend` (ou o nome que preferir)
   - **Root Directory**: clique em "Edit" e escolha `backend`
   - Ao definir o Root Directory, a Vercel mostra um checkbox **"Include source files outside
     of the Root Directory in the Build Step"** — **marque essa opção**. É o que faz o `npm
     install` rodar respeitando o `workspaces` da raiz do monorepo em vez de tratar `backend/`
     como um projeto isolado sem lockfile.
   - **Framework Preset**: `Other`
   - **Build Command**: deixe em branco/padrão (não precisa rodar `tsc` — a Vercel compila
     `api/index.ts` sozinha via runtime Node)
   - **Output Directory**: deixe em branco (não há build estático aqui)
3. Em **Environment Variables**, adicione (aplicar em Production, Preview e Development):

   | Nome | Valor |
   | --- | --- |
   | `SUPABASE_URL` | `https://euyezrijzrptczujckyq.supabase.co` |
   | `SUPABASE_ANON_KEY` | a chave `anon`/`publishable` do Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave `service_role`/`secret` — marque como **Sensitive** |
   | `CORS_ORIGINS` | `http://localhost:5173` (ajustamos no passo J3) |

4. **Deploy**. Você terá uma URL como `https://simple-flow-backend.vercel.app`.
5. Teste: abra `https://simple-flow-backend.vercel.app/api/health` — deve responder
   `{"status":"ok"}`. Se dor erro 500, confira se as 3 variáveis do Supabase foram salvas
   corretamente (erro mais comum: colar a chave errada ou esquecer de marcar todos os
   ambientes).

## J2 — Projeto do frontend

1. https://vercel.com/new novamente → importe o **mesmo repositório**.
2. Em **Configure Project**:
   - **Project Name**: `simple-flow` (ou o que preferir)
   - **Root Directory**: `frontend` (marque o mesmo checkbox de "include outside files")
   - **Framework Preset**: a Vercel deve detectar `Vite` automaticamente
   - **Build Command** / **Output Directory**: deixe o padrão do preset (`npm run build` / `dist`)
3. **Environment Variables**:

   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | `https://simple-flow-backend.vercel.app/api` (a URL real do passo J1) |
   | `VITE_USE_MOCK` | `false` |
   | `VITE_MOCK_LATENCY` | `350` (opcional, só é usado se `VITE_USE_MOCK=true`) |

4. **Deploy**. Você terá uma URL como `https://simple-flow.vercel.app`.

## J3 — Ajustar CORS com os domínios reais

1. Volte no projeto do **backend** → **Settings → Environment Variables**.
2. Edite `CORS_ORIGINS` para incluir o domínio real do frontend, separado por vírgula (sem
   espaço):
   ```
   https://simple-flow.vercel.app,http://localhost:5173
   ```
3. **Redeploy** o backend (Deployments → menu "..." do último deploy → Redeploy) — env vars só
   entram em vigor em deploys novos, editar o valor sozinho não reinicia a function.
4. Sobre **Preview Deployments** do frontend (cada branch/PR gera uma URL tipo
   `simple-flow-git-<branch>-<usuario>.vercel.app`): o `cors()` atual faz correspondência exata
   de string, então previews não vão passar no CORS a menos que você adicione cada URL
   manualmente em `CORS_ORIGINS`. Se isso incomodar no dia a dia, é possível trocar a
   configuração de CORS para aceitar um regex de subdomínio do seu time na Vercel — não fiz essa
   mudança agora para não adicionar comportamento além do que foi pedido, mas aviso que dá pra
   fazer se for útil.

## Checklist final

- [ ] `GET /api/health` do backend responde `{"status":"ok"}`
- [ ] Frontend carrega a tela de login em produção
- [ ] Login/registro funcionam contra o backend real (sem erro de CORS no console)
- [ ] `CORS_ORIGINS` do backend inclui o domínio real do frontend
- [ ] Nenhuma chave sensível foi commitada — env vars ficam só no dashboard da Vercel
