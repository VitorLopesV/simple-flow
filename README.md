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

### Conectando a um backend real

Por padrão o app usa dados de demonstração. Para usar o backend real, edite `frontend/.env`:

```
VITE_USE_MOCK=false
VITE_API_URL=<url da sua API>
```

---

## 📖 Mais informações

- Detalhes de arquitetura, estrutura de pastas e decisões técnicas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Convenções de código do frontend: [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
- Backend: [`simple-flow-backend`](https://github.com/VitorLopesV/simple-flow-backend)
