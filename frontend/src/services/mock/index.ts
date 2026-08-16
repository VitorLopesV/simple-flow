/**
 * Ponto de entrada da camada de mock.
 *
 * O `db` (que carrega o @faker-js/faker) é importado dinamicamente: em produção,
 * com `VITE_USE_MOCK=false`, o chunk simplesmente nunca é baixado, e o bundle
 * inicial não paga pelo custo do gerador de dados.
 */
type Db = typeof import('./db')

let cache: Promise<Db> | null = null

export function mockDb(): Promise<Db> {
  cache ??= import('./db')
  return cache
}

export { contemBusca, delay, normalizar, paginar } from './utils'
