# CLAUDE.md — Frontend (SimpleFlow)

## Stack

- Vue 3, exclusivamente **Composition API com `<script setup lang="ts">`** — nunca Options API ou `defineComponent` clássico.
- Vite 6, alias `@/` → `src/`. Dev server fixo na **porta 5180** (`vite.config.ts`).
- TypeScript 5.7 strict (`verbatimModuleSyntax: true` — usar sempre `import type { ... }` para tipos).
- `vue-router` 4, `pinia` 4 (setup stores), Tailwind CSS v4 (config 100% em CSS, sem `tailwind.config.js`).
- `vee-validate` para formulários (parcialmente adotado — ver seção Formulários), `axios`, `chart.js`/`vue-chartjs`, `vue-sonner` (toasts), `jspdf` (export PDF), `@lucide/vue` (ícones).
- **Sem ESLint/Prettier configurados.** Consistência é só por convenção — siga o código existente à risca.
- **Testes com Vitest** (`@vue/test-utils` + `happy-dom`): rode `npm run test` (raiz ou `frontend`). Arquivos `*.spec.ts` ficam ao lado do código testado; sem pasta `__tests__`, sem helpers globais, sem snapshots. Valide também manualmente via `npm run dev` quando a mudança for visual.

## Idioma do código — regra obrigatória

**Todo código deve estar em inglês.** Isso vale para nomes de arquivos, componentes, variáveis, funções, classes, tipos, interfaces, props, eventos, slots, stores, services, rotas (`name`), `id`s, `data-testid`s, classes CSS próprias e nomes de chaves de objetos do domínio — tanto no código de produção quanto nos testes. Não crie nenhum identificador novo em português.

Ficam em **português**, e só eles:
- **Textos exibidos ao usuário**: rótulos, mensagens, toasts, placeholders, `aria-label`, títulos, nome do arquivo PDF exportado.
- **Comentários e JSDoc** (continuam em português, explicando o "porquê").
- **Descrições de teste** (`describe`/`it`).
- **Contrato com a API e o banco** — ver a seção "Comunicação com backend": campos do JSON (`types/dto.ts`), parâmetros de query (`mes`, `ano`, `busca`, `competencia`...), rotas da API (`/saidas`, `/cartoes/faturas`...) e valores de enum gravados no banco (`'PENDENTE'`, `'CARTAO_CREDITO'`, `'ALIMENTACAO'`...). O tipo e a constante são em inglês (`ExpenseStatus`, `EXPENSE_STATUS_LABEL`), o valor continua o da API.
- **URLs das telas** (`path` das rotas, como `/app/saidas`), porque aparecem para o usuário e em links salvos.
- **Chaves já persistidas no `localStorage`** (`simpleflow.accessToken`, `fc:pasta-relatorios`...): trocar o valor apagaria dados dos usuários. A constante que guarda a chave é em inglês.

Glossário do domínio, para manter os nomes consistentes: entrada → `Income`, saída → `Expense`, cartão → `CreditCard`/`card`, fatura → `Invoice`, transação do cartão → `CardTransaction`, categoria → `Category`, período → `Period` (`{ month, year }`), competência → `referenceMonth`, resumo → `Summary`, valor → `amount`, descrição → `description`, vencimento → `dueDate`, pago em → `paidAt`, observação → `notes`, recorrente → `recurring`, parcela → `installment`.

## Estrutura

Organização por camada técnica (não por feature, não atomic design):

```
src/
├── components/
│   ├── common/     # design system genérico — prefixo Base* (BaseButton, BaseInput, BaseModal...)
│   ├── features/   # componentes de domínio (CreditCardForm, TransactionForm, UserMenu...)
│   └── layouts/    # chrome da aplicação — prefixo App* (AppLayout, AppHeader, AppSidebar)
├── pages/          # uma página por rota
├── composables/    # usePreferences, useNotify — estado singleton fora do Pinia
├── stores/         # Pinia setup stores, um por domínio + index.ts barrel
├── services/       # um arquivo por domínio (axios OU mock) + http.ts + mappers.ts + mock/
├── types/          # um arquivo por domínio + common.ts + dto.ts (formato da API) + index.ts barrel
└── utils/          # cn, currencyFormatter, dateFormatter, validators + index.ts barrel
```

Ao adicionar um recurso novo, crie o arquivo correspondente em cada camada (`types/x.ts`, `services/xService.ts`, `stores/xStore.ts`), seguindo o padrão de `creditCard`/`income`/`expense` — não agrupe tudo numa pasta por feature.

## Componentes

- Nome de arquivo em PascalCase. Prefixo `Base` = design system genérico; prefixo `App` = chrome/layout.
- Props via `defineProps<{...}>()` + `withDefaults`; `v-model` via `defineModel()`.
- `defineOptions({ inheritAttrs: false })` em componentes de input que repassam atributos para o elemento nativo.
- Props, eventos e slots em inglês, seguindo o padrão dos componentes base (`variant`, `size`, `disabled`, `loading`, `required`, `error`, `hint`; slots `header`, `actions`, `footer`; `v-model:open` em modais) — ver "Idioma do código".
- Acessibilidade é levada a sério neste projeto: `aria-invalid`, `aria-describedby`, `role="alert"`/`"dialog"`, `aria-modal`, foco preso em modais, skip-link, respeito a `prefers-reduced-motion`. Mantenha esse padrão em componentes novos.
- Sem lib de terceiros para popover/modal/focus-trap — tudo implementado manualmente (`BaseModal.vue` faz focus-trap e scroll-lock na mão, com `Teleport to="body"`). Siga esse padrão em vez de introduzir uma lib nova.
- Comentários JSDoc curtos em português acima de funções não triviais, explicando o "porquê" — padrão recorrente em quase todo arquivo.

## Estado

- **Pinia (setup store)** para estado de domínio/negócio: um store por domínio em `src/stores/`, com `loading`/`saving`/`error`, `computed` derivados, e ações assíncronas (`load`, `create`, `update`, `remove`) que chamam o `service`, capturam erro com `getErrorMessage()` e retornam `boolean` de sucesso.
- **Composable singleton fora do Pinia** (`usePreferences`) para preferências de UI puramente locais/de dispositivo, persistidas em `localStorage`. Regra: se é dado de negócio do usuário → Pinia; se é preferência de UI/dispositivo → composable singleton.
- `periodStore` (mês de competência selecionado) é compartilhado entre páginas — não recriar esse estado localmente numa página nova.

## Roteamento

- Duas árvores de layout: `/app/*` (autenticado, `AppLayout`) e `/auth/*` (público, `AuthLayout`).
- Toda página é lazy-loaded: `component: () => import('@/pages/X.vue')`.
- Guard global em `router.beforeEach` bloqueia `/app/*` sem sessão e redireciona usuário autenticado para fora de `/auth/*`. Cada rota tem `meta: { title, description }`. Os `name` das rotas são em inglês (`incomes`, `expenses`, `cards`, `register`); os `path` continuam em português (`/app/entradas`...).

## Comunicação com backend

- Serviço por domínio em `src/services/`, cliente axios único em `services/http.ts`.
- **O JSON da API é em português e o frontend é em inglês.** Os tipos em `types/dto.ts` descrevem o formato da API (campos em português) e `services/mappers.ts` converte nos dois sentidos (`toExpense`, `toExpensePayloadDto`...). A conversão acontece **só na chamada HTTP dos services** — stores, componentes e o mock já trabalham com os tipos de domínio em inglês. Ao adicionar ou mudar um campo da API, atualize o DTO, o mapper e o teste do mapper (`mappers.spec.ts`) juntos.
- **Todo método de service segue o padrão duplo mock/real**: checa `if (USE_MOCK) { ...; return delay(...) }` antes de cair na chamada axios real. Ao adicionar um endpoint novo, implemente os dois lados (mock em `services/mock/db.ts` + chamada real).
- `http.ts`: injeta `Authorization: Bearer <token>` via interceptor de request; interceptor de response faz **refresh automático em 401** (com flag de promise compartilhada para evitar refreshes concorrentes) e força hard redirect (`window.location.assign`, não `router.push`) para `/auth/login` se o refresh falhar.
- Erros são normalizados em `ApiError` com mensagens em pt-BR por status. Use sempre `getErrorMessage(error, fallback)` para extrair a mensagem a exibir em toast — não trate erro axios cru nos componentes.
- Modo mock é infraestrutura de primeira classe, não hack de teste: `VITE_USE_MOCK=true` roda o frontend inteiro sem backend. **Só liga com `'true'` explícito** — ausente ou qualquer outro valor usa o backend real, para que um deploy que esqueça a variável nunca suba em modo demonstração (no mock o login aceita qualquer credencial). Não inverta esse padrão. `mock/db.ts` usa faker com seed fixa e guarda os dados já no formato de domínio (não passa pelos mappers); `mock/index.ts` importa o db **dinamicamente** para não entrar no bundle de produção — preserve esse `import()` dinâmico ao mexer ali.

## Autenticação

- Token JWT (access + refresh) persistido em **`localStorage`** (`simpleflow.accessToken`, `simpleflow.refreshToken`, `simpleflow.user`) — não em cookies. A chave antiga `simpleflow.usuario` (usuário no formato da API) só é lida para migrar sessões abertas antes da troca de nomes. Trade-off consciente (simplicidade vs. exposição a XSS), não é bug.
- Fluxo: `Login.vue` → `authService.login` → `authStore.setSession` → guard de rota libera `/app/*`.
- Logout: `authStore.clearSession()` (limpa localStorage) + `router.push({ name: 'login' })`, feito pelo item "Sair" do menu do usuário (`UserMenu.vue`, no `AppHeader`), que também abre o `ProfileModal.vue` em "Meu perfil".

## Estilização e tema

- Tailwind v4, tokens semânticos estilo shadcn em `src/assets/main.css` (`--background`, `--card`, `--primary`, `--success`, `--danger`...), definidos em `:root`. **Componentes usam só as classes semânticas (`bg-card`, `text-muted`...), nunca cor crua.**
- O sistema tem **só o tema escuro**: não há modo claro, variante `dark:` nem seletor de tema. Os tokens ficam direto em `:root` e o `color-scheme: dark` também.
- Helper `cn()` próprio (não `clsx`/`tailwind-merge`) — **não faz merge de conflito de classes Tailwind**, então ao usá-lo, classes que devem sobrescrever precisam vir por último no array/args.
- `Chart.js` não lê CSS custom properties — resolva as cores manualmente (paleta fixa do tema escuro) em qualquer componente de gráfico novo (ver `StatisticsChart.vue`).

## Formulários

Padrão a seguir para telas novas: `vee-validate` (`useForm`/`useField`) + regras de `src/utils/validators.ts` (`required`, `minLength`, `positiveAmount`, `isoDate`, etc., combináveis via `compose(...)`) — é o padrão usado em `CreditCardForm.vue`/`TransactionForm.vue`. As telas de login/registro ainda validam manualmente (divergência histórica, não copie esse padrão em telas novas).

Para campos monetários, reutilize `CurrencyInput.vue` (aceita `1.234,56`, `1234.56`, `R$ 1.234,56` via `utils/currencyFormatter.ts`).

## Datas

Datas trafegam sempre como string `YYYY-MM-DD` (nunca `Date` cru). Ao converter para `Date`, sempre ao **meio-dia local** (`dateFormatter.ts`) para evitar bug de fuso horário (BRL é UTC-3). Preserve essa regra em qualquer código novo que manipule datas.

## Variáveis de ambiente

```
VITE_API_URL=http://localhost:3000/api   # também define o connect-src da CSP no build
VITE_USE_MOCK=true                       # só 'true' liga o mock; ausente = backend real
VITE_MOCK_LATENCY=350
```
Todas com prefixo `VITE_*` (exigido pelo Vite), tipadas em `env.d.ts`. Para desenvolver sem backend, copie `.env.example` para `.env`.

## Segurança (cabeçalhos HTTP)

- `vercel.json` envia `Content-Security-Policy`, `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff`. A CSP permite scripts só da própria origem (`script-src 'self'`, sem inline nem `eval`), estilos próprios + Google Fonts, fontes do `fonts.gstatic.com` e imagens `data:`/`blob:` (fotos de perfil e SVGs inlinados pelo Vite).
- O `vercel.json` é estático, então lá o `connect-src` é amplo (`'self' https:`). O plugin `apiConnectSrcCsp` do `vite.config.ts` injeta no `index.html` do build uma `<meta>` CSP que restringe o `connect-src` à origem de `VITE_API_URL`; o navegador aplica as duas políticas e vale a mais restritiva.
- **Ao adicionar qualquer recurso externo** (script, fonte, imagem, API de terceiros), atualize a CSP do `vercel.json` e valide o build (`npm run build`) sem violações no console. Não use scripts inline nem `eval`/`new Function`.

## Scripts

```
npm run dev          # vite
npm run build         # vue-tsc --build && vite build
npm run preview       # vite preview
npm run type-check    # vue-tsc --build --force
```

Do monorepo raiz: `npm run dev`, `npm run build`, etc. Deploy: projeto Vercel separado, root directory `frontend/` — ver a seção "Segurança no deploy" do [`../README.md`](../README.md).
