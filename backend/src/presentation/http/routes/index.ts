import { Router } from 'express'

import { authRoutes } from './auth.routes'
import { categoriasRoutes } from './categorias.routes'

export const routes = Router()

routes.get('/health', (_req, res) => res.json({ status: 'ok' }))
routes.use('/auth', authRoutes)
routes.use('/categorias', categoriasRoutes)
