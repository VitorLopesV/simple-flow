# Deploy do frontend na Vercel

O backend já está em deploy separado em
[`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend) (veja o `DEPLOY.md`
de lá). Este guia cobre só o frontend.

## Projeto do frontend

1. https://vercel.com/new → **Import Git Repository** → selecione `VitorLopesV/simple-flow`.
2. Em **Configure Project**:
   - **Project Name**: `simple-flow` (ou o que preferir)
   - **Root Directory**: `frontend`
   - **Framework Preset**: a Vercel deve detectar `Vite` automaticamente
   - **Build Command** / **Output Directory**: deixe o padrão do preset (`npm run build` / `dist`)
3. **Environment Variables**:

   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | URL do backend em produção + `/api` (ex.: `https://simple-flow-backend.vercel.app/api`) |
   | `VITE_USE_MOCK` | `false` |
   | `VITE_MOCK_LATENCY` | `350` (opcional, só é usado se `VITE_USE_MOCK=true`) |

4. **Deploy**. Você terá uma URL como `https://simple-flow.vercel.app`.

## Ajustar CORS com o domínio real do frontend

1. No projeto do **backend** (repositório `simple-flow-backend`) → **Settings → Environment
   Variables**.
2. Edite `CORS_ORIGINS` para incluir o domínio real do frontend, separado por vírgula (sem
   espaço):
   ```
   https://simple-flow.vercel.app,http://localhost:5173
   ```
3. **Redeploy** o backend — env vars só entram em vigor em deploys novos, editar o valor sozinho
   não reinicia a function.
4. Sobre **Preview Deployments** do frontend (cada branch/PR gera uma URL tipo
   `simple-flow-git-<branch>-<usuario>.vercel.app`): o `cors()` atual faz correspondência exata
   de string, então previews não vão passar no CORS a menos que você adicione cada URL
   manualmente em `CORS_ORIGINS`.

## Checklist final

- [ ] `GET /api/health` do backend responde `{"status":"ok"}`
- [ ] Frontend carrega a tela de login em produção
- [ ] Login/registro funcionam contra o backend real (sem erro de CORS no console)
- [ ] `CORS_ORIGINS` do backend inclui o domínio real do frontend
- [ ] Nenhuma chave sensível foi commitada — env vars ficam só no dashboard da Vercel
