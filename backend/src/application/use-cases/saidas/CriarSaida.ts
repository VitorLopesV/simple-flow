import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'

export class CriarSaida {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  execute(userId: ID, payload: SaidaPayload): Promise<Saida> {
    return this.saidaRepository.criar(userId, payload)
  }
}
