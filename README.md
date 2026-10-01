# Sistema de Controle Financeiro

Aplicação web para controle financeiro pessoal: acompanhamento de entradas e saídas, cartões de
crédito com faturas, categorização de gastos e um dashboard com visão geral do mês.

Este repositório contém o **frontend** (Vue 3 + TypeScript). O backend (Node.js + Express +
Supabase) vive em um repositório separado:
[`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend).

O frontend roda **100% funcional sem backend**: por padrão ele usa um modo demonstração com dados
gerados automaticamente, sem precisar configurar nada.

---

## 🛠️ Tecnologias

- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vitejs.dev/) — build e dev server
- [Pinia](https://pinia.vuejs.org/) — gerenciamento de estado
- [Vue Router](https://router.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Axios](https://axios-http.com/)
- [Chart.js](https://www.chartjs.org/) — gráficos do dashboard
- [VeeValidate](https://vee-validate.logaretm.com/) — validação de formulários
- [Vitest](https://vitest.dev/) — testes

---

## ✅ Pré-requisitos

| Ferramenta | Versão |
| ---------- | ------ |
| Node.js    | ≥ 20.19 |
| npm        | ≥ 10 |

---

## 🚀 Como rodar

A partir da raiz do projeto:

```bash
npm install
npm run dev
```

A aplicação sobe em **http://localhost:5173**.

### Outros scripts

| Script              | O que faz                                     |
| -------------------- | ---------------------------------------------- |
| `npm run dev`         | Servidor de desenvolvimento com hot reload      |
| `npm run build`       | Gera o build de produção                        |
| `npm run preview`     | Serve localmente o build de produção            |
| `npm run type-check`  | Checagem de tipos TypeScript                    |
| `npm run test`        | Roda os testes                                  |

### Modo demonstração x backend real

Por padrão o app usa o **backend real**, na URL de `VITE_API_URL`. Para rodar sem backend, com
dados de demonstração em memória, copie `frontend/.env.example` para `frontend/.env` (ele já traz
`VITE_USE_MOCK=true`). O modo demonstração só liga com `VITE_USE_MOCK=true` explícito: no mock o
login aceita qualquer e-mail e senha, então ele nunca deve ser ligado em produção.

```
# backend real (padrão): basta a URL da API, sem VITE_USE_MOCK
VITE_API_URL=<url da sua API>
```

### Segurança no deploy

O `frontend/vercel.json` envia `Content-Security-Policy`, `X-Frame-Options: DENY` e
`X-Content-Type-Options: nosniff` em todas as respostas. Além disso, o build injeta no `index.html`
uma CSP que restringe o `connect-src` à origem de `VITE_API_URL`, então a variável precisa estar
definida no ambiente de build da Vercel. Se o frontend passar a carregar recursos de outro
domínio (fontes, imagens, scripts), a CSP do `vercel.json` precisa ser atualizada junto.

---

## 📖 Mais informações

- Detalhes de arquitetura, estrutura de pastas e decisões técnicas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Convenções de código do frontend: [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
- Backend: [`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend)
