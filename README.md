# Sistema de Controle Financeiro

Frontend em Vue 3 + TypeScript do sistema de controle financeiro pessoal. O backend (Node.js +
TypeScript, Express, arquitetura limpa, Supabase) vive em um repositório separado:
[`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend).

O frontend roda 100% funcional sem backend: a camada de serviços possui um **modo mock** em
memória alimentado por dados gerados com `@faker-js/faker` (seed fixa). Para plugar o backend
real basta trocar uma variável de ambiente.

---

## 📁 Estrutura

```
financial-control/
├── frontend/          # aplicação Vue 3 (workspace npm)
│   ├── public/
│   ├── src/
│   └── package.json
├── package.json       # raiz do workspace: delega os scripts para o frontend
└── README.md
```

O backend fica em [`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend),
um repositório separado (deploy independente na Vercel).

---

## ✅ Pré-requisitos

| Ferramenta | Versão |
| ---------- | ------ |
| Node.js    | **≥ 20.19** (testado em 22.9.0) |
| npm        | ≥ 10 (testado em 11.14.0) |

> O projeto usa **Vite 6** propositalmente: o Vite 7 exige Node ≥ 22.12, e a máquina de
> desenvolvimento roda Node 22.9. Se você estiver em Node ≥ 22.12 pode subir para o Vite 7 sem
> nenhuma outra alteração de código.

---

## 🚀 Setup

A partir da raiz `financial-control/`:

```bash
npm install
npm run dev
```

A aplicação sobe em **http://localhost:5173** e redireciona para `/pages/dashboard`.

O `npm install` na raiz já instala as dependências do workspace `frontend` — não é necessário
entrar na pasta.

### Scripts disponíveis (raiz)

| Script                 | O que faz                                                        |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento Vite com HMR (porta 5173)             |
| `npm run build`        | `vue-tsc --build` + build de produção em `frontend/dist`          |
| `npm run preview`      | Serve localmente o build de produção                              |
| `npm run type-check`   | Checagem de tipos com `vue-tsc` (sem emitir)                      |

Todos existem também dentro de `frontend/` caso prefira rodar de lá.

---

## ⚙️ Variáveis de ambiente

O arquivo `frontend/.env` já vem preenchido para o modo demonstração (e `frontend/.env.example`
serve de referência):

| Variável             | Padrão                      | Descrição                                                                 |
| -------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `VITE_API_URL`       | `http://localhost:3000/api` | URL base da API REST, usada quando o mock está desligado                   |
| `VITE_USE_MOCK`      | `true`                      | `true` usa os dados em memória; `false` chama o backend real via Axios     |
| `VITE_MOCK_LATENCY`  | `350`                       | Latência artificial (ms) do mock, para exercitar loadings e skeletons      |

### Dados de demonstração

Com `VITE_USE_MOCK=true`:

- os dados são gerados por `@faker-js/faker` (locale `pt_BR`) com **seed fixa**, então cada
  recarga produz exatamente o mesmo cenário: 8 meses de entradas e saídas, 3 cartões com faturas
  e transações parceladas;
- as alterações (criar/editar/excluir/pagar fatura) valem apenas para a sessão — **não são
  persistidas**;
- o módulo de mock fica atrás de um `import()` dinâmico e cai em um chunk separado
  (`assets/db-*.js`), ou seja, o faker **não entra no bundle principal** e nem é baixado quando o
  mock está desligado.

### Apontando para um backend real

1. `VITE_USE_MOCK=false`
2. `VITE_API_URL=<url da sua API>`

Nenhuma outra mudança é necessária: cada método de serviço já implementa os dois caminhos. O
contrato esperado (rotas, payloads e respostas) está descrito no README do
[`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend).

---

## 🧭 Páginas

| Rota                | Conteúdo                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `/pages/dashboard`  | Cards totalizadores, gráfico de barras Entradas × Saídas (6 meses), rosca de gastos por categoria, últimas transações e comprometimento da renda |
| `/pages/entradas`   | Listagem por período, filtro por categoria, busca, paginação, criar/editar/excluir e total do mês  |
| `/pages/saidas`     | Idem entradas + filtro por status (Pago/Pendente), forma de pagamento e vínculo com cartão         |
| `/pages/cartoes`    | Cartões cadastrados, uso do limite, fatura da competência, transações da fatura e baixa de pagamento |

O mês selecionado é global (store `periodo`) e se mantém ao navegar entre as páginas.

---

## 🏗️ Arquitetura do frontend

```
frontend/src/
├── assets/            # main.css: design tokens (oklch), tema claro/escuro, base layer
├── components/
│   ├── common/        # átomos/moléculas: BaseButton, BaseInput, BaseModal, CurrencyInput...
│   ├── features/      # organismos de domínio: TransactionForm, TransactionList,
│   │                  # CategoryFilter, MonthPicker, SummaryCard, StatisticsChart,
│   │                  # CartaoCard, CartaoForm, FaturaDetalhe
│   └── layouts/       # AppLayout, AppHeader, AppSidebar, PageLayout
├── composables/       # useTheme, useNotify
├── pages/             # Dashboard, Entradas, Saidas, Cartoes, NotFound
├── router/            # rotas com lazy loading, títulos por rota e guarda de autenticação
├── services/          # auth/entrada/saida/cartao/categoria/dashboard + http (Axios)
│   └── mock/          # base em memória gerada com faker (import dinâmico)
├── stores/            # Pinia: auth, periodo, categoria, entrada, saida, cartao, dashboard
├── types/             # auth, entrada, saida, cartao, categoria, dashboard, common
├── utils/             # currencyFormatter, dateFormatter, validators, cn
├── App.vue
└── main.ts
```

Fluxo de dados: **página → store (Pinia) → service → mock ou Axios**. Componentes não chamam
serviços diretamente; toda a orquestração (filtros, paginação, loading, erro) fica nas stores.

### Stack

- **Vue 3.5** com `<script setup>` e Composition API
- **TypeScript** em modo estrito (`verbatimModuleSyntax`, `noUnusedLocals`, project references)
- **Pinia** (setup stores) para estado centralizado
- **Vue Router 4** com code splitting por rota
- **Axios** com interceptor que traduz erros HTTP para mensagens em pt-BR
- **Tailwind CSS v4** via `@tailwindcss/vite` (tokens semânticos, tema claro/escuro)
- **VeeValidate 4** com regras próprias (sem yup/zod)
- **Chart.js 4 + vue-chartjs** com registro tree-shaken
- **vue-sonner** para toasts
- **Vite 6** como bundler

### Decisões

- **Componentes de UI escritos à mão** no estilo shadcn em vez de instalar shadcn/vue (reka-ui) ou
  PrimeVue — atende ao requisito de não adicionar bibliotecas desnecessárias e mantém controle
  total sobre acessibilidade e tokens de tema.
- **Validação com funções puras** (`utils/validators.ts`) compostas via `compor()`, evitando um
  schema validator extra.
- **Chart.js** com componentes registrados individualmente, isolado em um chunk `charts`.

---

## ♿ Acessibilidade

- Skip link "Pular para o conteúdo" e landmarks (`header`, `nav`, `main`)
- Foco visível padronizado (`:focus-visible`) e `focus trap` nos modais (Tab cíclico, Esc fecha,
  foco restaurado ao elemento de origem)
- `aria-label`, `aria-invalid`, `aria-describedby` nos campos; `role="switch"` no toggle
- Tabelas com `<caption>`/cabeçalhos e alternativa em cards no mobile
- Respeito a `prefers-reduced-motion`

---

## 📦 Build de produção

```bash
npm run build
npm run preview
```

Saída em `frontend/dist`, com separação automática de chunks:

| Chunk    | Conteúdo                                       |
| -------- | ---------------------------------------------- |
| `index`  | app + Vue + Pinia + Router (~136 kB / 48 kB gz) |
| `charts` | Chart.js + vue-chartjs                          |
| `db`     | dados de mock (faker) — só baixado no modo demo |
| por rota | cada página é um chunk carregado sob demanda    |

---

## 🗂️ Categorias iniciais

| Tipo (`CategoriaTipo`)        | Categorias                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| Conta Fixa (`CONTA_FIXA`)     | Aluguel, Energia, Água, Internet, Plano de Saúde               |
| Conta Variável (`CONTA_VARIAVEL`) | Alimentação, Transporte, Lazer, Compras, Educação          |
| Renda (`RENDA`)               | Salário, Freelance, Reembolso                                  |
| Investimentos (`INVESTIMENTO`) | Poupança, Ações (saída/aporte), Rendimentos (entrada)         |

Cada categoria declara também o `movimento` (`ENTRADA` ou `SAIDA`), e os formulários só exibem as
categorias compatíveis com o tipo de lançamento em edição.

---

## 🔌 Backend

Repositório separado: [`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend)
(Node.js + TypeScript, Express, arquitetura limpa, Supabase para persistência e autenticação,
isolamento multi-tenant via Row Level Security).

---

## 🚀 Deploy

Guia passo a passo para publicar o frontend na Vercel em [`DEPLOY.md`](./DEPLOY.md). O backend tem
seu próprio guia no repositório dele.
