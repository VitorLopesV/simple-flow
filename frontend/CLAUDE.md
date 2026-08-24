# CLAUDE.md — Frontend (SimpleFlow)

## Stack

- Vue 3, exclusivamente **Composition API com `<script setup lang="ts">`** — nunca Options API ou `defineComponent` clássico.
- Vite 6, alias `@/` → `src/`. Dev server fixo na **porta 5180** (`vite.config.ts`).
- TypeScript 5.7 strict (`verbatimModuleSyntax: true` — usar sempre `import type { ... }` para tipos).
- `vue-router` 4, `pinia` 4 (setup stores), Tailwind CSS v4 (config 100% em CSS, sem `tailwind.config.js`).
- `vee-validate` para formulários (parcialmente adotado — ver seção Formulários), `axios`, `chart.js`/`vue-chartjs`, `vue-sonner` (toasts), `jspdf` (export PDF), `@lucide/vue` (ícones).
- **Sem ESLint/Prettier e sem framework de testes configurados.** Consistência é só por convenção — siga o código existente à risca. Não há suíte de testes para rodar; valide manualmente via `npm run dev`.

## Estrutura

Organização por camada técnica (não por feature, não atomic design):

```
src/
├── components/
│   ├── common/     # design system genérico — prefixo Base* (BaseButton, BaseInput, BaseModal...)
│   ├── features/   # componentes de domínio (CartaoForm, TransactionForm, UsuarioPopover...)
│   └── layouts/    # chrome da aplicação — prefixo App* (AppLayout, AppHeader, AppSidebar)
├── pages/          # uma página por rota
├── composables/    # useTheme, usePreferencias, useNotify — estado singleton fora do Pinia
├── stores/         # Pinia setup stores, um por domínio + index.ts barrel
├── services/       # um arquivo por domínio (axios OU mock) + http.ts + mock/
├── types/          # um arquivo por domínio + common.ts + index.ts barrel
└── utils/          # cn, currencyFormatter, dateFormatter, validators + index.ts barrel
```

Ao adicionar um recurso novo, crie o arquivo correspondente em cada camada (`types/x.ts`, `services/xService.ts`, `stores/xStore.ts`), seguindo o padrão de `cartao`/`entrada`/`saida` — não agrupe tudo numa pasta por feature.

## Componentes

- Nome de arquivo em PascalCase. Prefixo `Base` = design system genérico; prefixo `App` = chrome/layout.
- Props via `defineProps<{...}>()` + `withDefaults`; `v-model` via `defineModel()`.
- `defineOptions({ inheritAttrs: false })` em componentes de input que repassam atributos para o elemento nativo.
- Props, variáveis e nomes de domínio em **português** (`variante`, `tamanho`, `desabilitado`, `carregando`, `obrigatorio`). Nomes técnicos genéricos em inglês.
- Acessibilidade é levada a sério neste projeto: `aria-invalid`, `aria-describedby`, `role="alert"`/`"dialog"`, `aria-modal`, foco preso em modais, skip-link, respeito a `prefers-reduced-motion`. Mantenha esse padrão em componentes novos.
- Sem lib de terceiros para popover/modal/focus-trap — tudo implementado manualmente (`BaseModal.vue` faz focus-trap e scroll-lock na mão, com `Teleport to="body"`). Siga esse padrão em vez de introduzir uma lib nova.
- Comentários JSDoc curtos em português acima de funções não triviais, explicando o "porquê" — padrão recorrente em quase todo arquivo.

## Estado

- **Pinia (setup store)** para estado de domínio/negócio: um store por domínio em `src/stores/`, com `loading`/`salvando`/`erro`, `computed` derivados, e ações assíncronas (`carregar`, `criar`, `atualizar`, `remover`) que chamam o `service`, capturam erro com `mensagemDeErro()` e retornam `boolean` de sucesso.
- **Composable singleton fora do Pinia** (`useTheme`, `usePreferencias`) para preferências de UI puramente locais/de dispositivo, persistidas em `localStorage`. Regra: se é dado de negócio do usuário → Pinia; se é preferência de UI/dispositivo → composable singleton.
- `periodoStore` (mês de competência selecionado) é compartilhado entre páginas — não recriar esse estado localmente numa página nova.

## Roteamento

- Duas árvores de layout: `/app/*` (autenticado, `AppLayout`) e `/auth/*` (público, `AuthLayout`).
- Toda página é lazy-loaded: `component: () => import('@/pages/X.vue')`.
- Guard global em `router.beforeEach` bloqueia `/app/*` sem sessão e redireciona usuário autenticado para fora de `/auth/*`. Cada rota tem `meta: { titulo, descricao }`, usado por `router.afterEach` para setar `document.title`.

## Comunicação com backend

- Serviço por domínio em `src/services/`, cliente axios único em `services/http.ts`.
- **Todo método de service segue o padrão duplo mock/real**: checa `if (USE_MOCK) { ...; return delay(...) }` antes de cair na chamada axios real. Ao adicionar um endpoint novo, implemente os dois lados (mock em `services/mock/db.ts` + chamada real).
- `http.ts`: injeta `Authorization: Bearer <token>` via interceptor de request; interceptor de response faz **refresh automático em 401** (com flag de promise compartilhada para evitar refreshes concorrentes) e força hard redirect (`window.location.assign`, não `router.push`) para `/auth/login` se o refresh falhar.
- Erros são normalizados em `ApiError` com mensagens em pt-BR por status. Use sempre `mensagemDeErro(erro, padrao)` para extrair a mensagem a exibir em toast — não trate erro axios cru nos componentes.
- Modo mock é infraestrutura de primeira classe, não hack de teste: `VITE_USE_MOCK=true` roda o frontend inteiro sem backend. `mock/db.ts` usa faker com seed fixa; `mock/index.ts` importa o db **dinamicamente** para não entrar no bundle de produção — preserve esse `import()` dinâmico ao mexer ali.

## Autenticação

- Token JWT (access + refresh) persistido em **`localStorage`** (`simpleflow.accessToken`, `simpleflow.refreshToken`, `simpleflow.usuario`) — não em cookies. Trade-off consciente (simplicidade vs. exposição a XSS), não é bug.
- Fluxo: `Login.vue` → `authService.login` → `authStore.definirSessao` → guard de rota libera `/app/*`.
- Logout: `authStore.limparSessao()` (limpa localStorage) + `router.push({ name: 'login' })`, feito a partir de `UsuarioPopover.vue` (no `AppHeader`).

## Estilização e tema

- Tailwind v4, tokens semânticos estilo shadcn em `src/assets/main.css` (`--background`, `--card`, `--primary`, `--success`, `--danger`...), duplicados em `:root` e `.dark`. **Componentes usam só as classes semânticas (`bg-card`, `text-muted`...), nunca cor crua.**
- Tema claro/escuro via classe `.dark` no `<html>`, controlado por `useTheme()`. Aplicado antes da primeira pintura por script inline em `index.html` (evita FOUC) — não remover esse script.
- Helper `cn()` próprio (não `clsx`/`tailwind-merge`) — **não faz merge de conflito de classes Tailwind**, então ao usá-lo, classes que devem sobrescrever precisam vir por último no array/args.
- `Chart.js` não lê CSS custom properties — resolva cores do tema manualmente via `computed` a partir de `useTheme()` em qualquer componente de gráfico novo (ver `StatisticsChart.vue`).

## Formulários

Padrão a seguir para telas novas: `vee-validate` (`useForm`/`useField`) + regras de `src/utils/validators.ts` (`obrigatorio`, `minimoCaracteres`, `valorMonetarioPositivo`, `dataISO`, etc., combináveis via `compor(...)`) — é o padrão usado em `CartaoForm.vue`/`TransactionForm.vue`. As telas de login/registro ainda validam manualmente (divergência histórica, não copie esse padrão em telas novas).

Para campos monetários, reutilize `CurrencyInput.vue` (aceita `1.234,56`, `1234.56`, `R$ 1.234,56` via `utils/currencyFormatter.ts`).

## Datas

Datas trafegam sempre como string `YYYY-MM-DD` (nunca `Date` cru). Ao converter para `Date`, sempre ao **meio-dia local** (`dateFormatter.ts`) para evitar bug de fuso horário (BRL é UTC-3). Preserve essa regra em qualquer código novo que manipule datas.

## Variáveis de ambiente

```
VITE_API_URL=http://localhost:3000/api
VITE_USE_MOCK=true|false
VITE_MOCK_LATENCY=350
```
Todas com prefixo `VITE_*` (exigido pelo Vite), tipadas em `env.d.ts`.

## Gotchas conhecidos

- **Favicon possivelmente quebrado**: `index.html` referencia `/logo-favicon.png` (esperado em `public/`), mas `public/` está vazia e o arquivo real está em `src/img/logo-favicon.png`. Ao mexer em favicon/branding, mover o arquivo para `public/logo-favicon.png` ou ajustar o `href`.
- `UsuarioPopover` (troca de tema) e `ConfiguracoesModal` (troca de tema) são dois pontos de UI para a mesma ação — intencional, ambos usam `useTheme()` como fonte única de verdade, sem risco de dessincronia.

## Scripts

```
npm run dev          # vite
npm run build         # vue-tsc --build && vite build
npm run preview       # vite preview
npm run type-check    # vue-tsc --build --force
```

Do monorepo raiz: `npm run dev:frontend`, `npm run build:frontend`, etc. Deploy detalhado em [`../DEPLOY.md`](../DEPLOY.md) (projeto Vercel separado, root directory `frontend/`).
