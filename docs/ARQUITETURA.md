# Arquitetura e decisões técnicas

Detalhes de implementação do frontend. Para visão geral do projeto e instruções de uso, veja o
[README](../README.md).

---

## 🧭 Páginas

| Rota                | Conteúdo                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `/pages/dashboard`  | Cards totalizadores, gráfico de barras Entradas × Saídas (6 meses), rosca de gastos por categoria, últimas transações e comprometimento da renda |
| `/pages/entradas`   | Listagem por período, filtro por categoria, busca, paginação, criar/editar/excluir e total do mês  |
| `/pages/saidas`     | Idem entradas + filtro por status (Pago/Pendente) e forma de pagamento; a fatura de cada cartão entra como uma saída só de leitura (editável na aba Cartões) |
| `/pages/cartoes`    | Cartões cadastrados, uso do limite, fatura da competência, lançamento/edição/remoção de débitos do cartão e baixa de pagamento |

O mês selecionado é global (store `periodo`) e se mantém ao navegar entre as páginas.

---

## 🏗️ Arquitetura do frontend

```
frontend/src/
├── assets/            # main.css: design tokens (oklch), tema escuro, base layer
├── components/
│   ├── common/        # átomos/moléculas: BaseButton, BaseInput, BaseModal, CurrencyInput...
│   ├── features/      # organismos de domínio: TransactionForm, TransactionList,
│   │                  # CategoryFilter, MonthPicker, SummaryCard, StatisticsChart,
│   │                  # CartaoCard, CartaoForm, FaturaDetalhe
│   └── layouts/       # AppLayout, AppHeader, AppSidebar, PageLayout
├── composables/       # usePreferencias, useNotify
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
| -------- | ----------------------------------------------- |
| `index`  | app + Vue + Pinia + Router (~136 kB / 48 kB gz) |
| `charts` | Chart.js + vue-chartjs                          |
| `db`     | dados de mock (faker) — só baixado no modo demo |
| por rota | cada página é um chunk carregado sob demanda    |

---

## 🗂️ Categorias iniciais

| Tipo (`CategoriaTipo`)        | Categorias                                                    |
| ------------------------------ | -------------------------------------------------------------- |
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

O contrato esperado (rotas, payloads e respostas) está descrito no README desse repositório.

---

## 🚀 Deploy

Frontend publicado na Vercel (Root Directory `frontend`, preset Vite). O backend tem deploy
próprio no repositório dele.

---

## Dados de demonstração (modo mock)

Com `VITE_USE_MOCK=true`:

- os dados são gerados por `@faker-js/faker` (locale `pt_BR`) com **seed fixa**, então cada
  recarga produz exatamente o mesmo cenário: 8 meses de entradas e saídas, 3 cartões com faturas
  e transações parceladas;
- as alterações (criar/editar/excluir/pagar fatura) valem apenas para a sessão — **não são
  persistidas**;
- o módulo de mock fica atrás de um `import()` dinâmico e cai em um chunk separado
  (`assets/db-*.js`), ou seja, o faker **não entra no bundle principal** e nem é baixado quando o
  mock está desligado.

Para conventions de código e detalhes voltados a agentes de IA, veja
[`frontend/CLAUDE.md`](../frontend/CLAUDE.md).
