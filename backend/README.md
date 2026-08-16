# Backend

> ⚠️ **Fora do escopo desta entrega.** Esta pasta existe apenas para reservar o espaço do
> backend no monorepo. Nada aqui é instalado ou executado pelo `npm install` da raiz
> (o workspace declarado é somente `frontend`).

## Contrato esperado pelo frontend

O frontend já está preparado para consumir uma API REST. Enquanto o backend não existe,
ele roda com uma camada de mock em memória (`frontend/src/services/mock`), ativada pela
variável `VITE_USE_MOCK=true`.

Para plugar um backend real basta:

1. Subir a API na URL configurada em `frontend/.env` (`VITE_API_URL`).
2. Trocar `VITE_USE_MOCK` para `false`.

Nenhuma alteração de código é necessária: cada service (`entradaService`, `saidaService`,
`cartaoService`, `categoriaService`) já tem os dois caminhos implementados.

### Endpoints esperados

| Método | Rota                          | Descrição                                    |
| ------ | ----------------------------- | -------------------------------------------- |
| GET    | `/categorias`                 | Lista todas as categorias                     |
| GET    | `/entradas`                   | Lista paginada (query: `mes`, `ano`, `categoriaId`, `busca`, `page`, `pageSize`) |
| GET    | `/entradas/resumo`            | Totalizadores do período                      |
| POST   | `/entradas`                   | Cria entrada                                  |
| PUT    | `/entradas/:id`               | Atualiza entrada                              |
| DELETE | `/entradas/:id`               | Remove entrada                                |
| GET    | `/saidas`                     | Lista paginada (mesmos filtros + `status`)    |
| GET    | `/saidas/resumo`              | Totalizadores do período                      |
| POST   | `/saidas`                     | Cria saída                                    |
| PUT    | `/saidas/:id`                 | Atualiza saída                                |
| DELETE | `/saidas/:id`                 | Remove saída                                  |
| GET    | `/cartoes`                    | Lista cartões                                 |
| POST   | `/cartoes`                    | Cria cartão                                   |
| PUT    | `/cartoes/:id`                | Atualiza cartão                               |
| DELETE | `/cartoes/:id`                | Remove cartão                                 |
| GET    | `/cartoes/:id/faturas`        | Faturas do cartão (query: `mes`, `ano`)       |
| PATCH  | `/faturas/:id/pagar`          | Marca fatura como paga                        |
| GET    | `/dashboard/resumo`           | Consolidado do período para o dashboard       |

Os formatos de request/response estão tipados em `frontend/src/types`.
