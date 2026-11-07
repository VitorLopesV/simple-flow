import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellHookData, CellInput, RowInput } from 'jspdf-autotable'

import type { PageRequest, Paginated, Period } from '@/types/common'
import type { CreditCardWithInvoice } from '@/types/creditCard'
import { INVOICE_STATUS_LABEL } from '@/types/creditCard'
import type { Expense } from '@/types/expense'
import {
  EXPENSE_OVERDUE_LABEL,
  EXPENSE_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  isExpenseOverdue,
} from '@/types/expense'
import { INCOME_TYPE_LABEL } from '@/types/income'
import type { Income } from '@/types/income'
import { categoryService } from './categoryService'
import { creditCardService } from './creditCardService'
import { expenseService } from './expenseService'
import { incomeService } from './incomeService'
import { buildReportData } from './reportData'
import type { CategoryBar, ReportGroup, TypeSlice } from './reportData'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, formatPeriod, toISODate, toReferenceMonth } from '@/utils/dateFormatter'

const MARGIN = 40
/** Espaço reservado no pé de cada página para "Página X de Y". */
const FOOTER_SPACE = 28
/*
 * Decisão (issue #81): o PDF mantém a Helvetica embutida do jsPDF em vez de Montserrat.
 * Usar Montserrat exigiria embutir os arquivos TTF convertidos em base64 (addFileToVFS/addFont),
 * aumentando o bundle em centenas de KB por peso, por ganho apenas estético num relatório.
 * Pelo mesmo motivo os textos usam só caracteres da WinAnsi (sem "−" nem "↻").
 */
/** Maior `pageSize` aceito pela API (`max(100)` nos schemas de listagem do backend). */
const PAGE_SIZE = 100

type RGB = [number, number, number]

/*
 * Paleta do relatório: tema claro, para imprimir. O PDF não lê as variáveis CSS do app
 * (o tema do sistema é escuro), então as cores ficam fixas aqui.
 */
const INK: RGB = [30, 41, 59]
const MUTED: RGB = [100, 116, 139]
const BORDER: RGB = [226, 232, 240]
const SURFACE: RGB = [248, 250, 252]
const BRAND: RGB = [5, 150, 105]
const INCOME_COLOR: RGB = [5, 150, 105]
const EXPENSE_COLOR: RGB = [225, 29, 72]
const INVOICE_COLOR: RGB = [79, 70, 229]
const PAID_COLOR: RGB = [5, 150, 105]
const PENDING_COLOR: RGB = [217, 119, 6]
const OVERDUE_COLOR: RGB = [220, 38, 38]

/** Quantidade de barras por gráfico; o resto vira "Outras". */
const MAX_BARS = 6

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value
  const number = Number.parseInt(full, 16)
  if (Number.isNaN(number)) return MUTED
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

/** jspdf-autotable amplia `doc` em tempo de execução, mas não expõe o tipo. */
function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/**
 * Percorre todas as páginas de uma listagem paginada. O relatório precisa do período
 * inteiro, mas a API rejeita (400) `pageSize` acima de 100 — pedir tudo de uma vez
 * fazia a exportação falhar com o backend real.
 */
async function listAll<T>(
  list: (page: PageRequest) => Promise<Paginated<T>>,
): Promise<T[]> {
  const first = await list({ page: 1, pageSize: PAGE_SIZE })
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) =>
      list({ page: i + 2, pageSize: PAGE_SIZE }),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

/** Junta as barras além do limite numa só ("Outras"), para o gráfico caber na página 1. */
function limitBars(bars: CategoryBar[]): CategoryBar[] {
  if (bars.length <= MAX_BARS) return bars
  const head = bars.slice(0, MAX_BARS - 1)
  const rest = bars.slice(MAX_BARS - 1)
  return [
    ...head,
    { name: 'Outras', color: '#94a3b8', total: rest.reduce((sum, bar) => sum + bar.total, 0) },
  ]
}

/** Texto da situação de uma saída à vista, com a derivada "Vencido". */
function expenseStatusText(expense: Expense, today: string): { text: string; color: RGB } {
  if (isExpenseOverdue(expense, today)) return { text: EXPENSE_OVERDUE_LABEL, color: OVERDUE_COLOR }
  if (expense.status === 'PAGO') return { text: EXPENSE_STATUS_LABEL.PAGO, color: PAID_COLOR }
  return { text: EXPENSE_STATUS_LABEL.PENDENTE, color: PENDING_COLOR }
}

/** Parcela só aparece em compras parceladas. */
function installmentText(installment: number, total: number): string {
  return total > 1 ? `${installment}/${total}` : '—'
}

/** Linha extra de um lançamento: etiqueta de recorrência e/ou observação. */
interface SubRowInfo {
  recurring: boolean
  notes?: string | null
}

const TAG_TEXT = 'Recorrente'
const TAG_FONT_SIZE = 6.5

/**
 * Monta as linhas de uma tabela de lançamentos. Recorrência (etiqueta) e observação (texto
 * cinza) ficam numa linha extra logo abaixo, em vez de uma coluna, para as tabelas não
 * alargarem. Devolve também o que cada linha precisa nos hooks de desenho.
 */
function buildRows<T extends SubRowInfo>(
  items: T[],
  columns: number,
  mainCells: (item: T) => CellInput[],
  tagWidth: number,
): { rows: RowInput[]; tagRows: Set<number>; mainRowItem: Map<number, T> } {
  const rows: RowInput[] = []
  const tagRows = new Set<number>()
  const mainRowItem = new Map<number, T>()

  for (const item of items) {
    const notes = item.notes?.trim()
    const hasSub = item.recurring || Boolean(notes)

    mainRowItem.set(rows.length, item)
    // Sem a linha de baixo, a borda inferior fica na própria linha; com ela, na extra.
    rows.push(
      mainCells(item).map((content) => ({
        content: content as string,
        styles: hasSub ? { lineWidth: 0 } : {},
      })),
    )

    if (hasSub) {
      if (item.recurring) tagRows.add(rows.length)
      rows.push([
        {
          content: notes ?? '',
          colSpan: columns,
          styles: {
            textColor: MUTED,
            fontSize: 7.5,
            minCellHeight: 11,
            cellPadding: { top: 0, bottom: 4, left: item.recurring ? tagWidth + 8 : 3, right: 3 },
          },
        },
      ])
    }
  }
  return { rows, tagRows, mainRowItem }
}

/** Gera e baixa um PDF com entradas, saídas e cartões do período informado. */
export async function exportPdfReport(period: Period): Promise<void> {
  const [incomes, expenses, cards, categories] = await Promise.all([
    listAll((page) => incomeService.list({ period, ...page })),
    listAll((page) => expenseService.list({ period, ...page })),
    creditCardService.listWithInvoices({ period }),
    categoryService.list(),
  ])

  // Data local (BRL é UTC-3): `toISOString` viraria o dia antes do fim da tarde e erraria o "Vencido".
  const today = toISODate(new Date())
  const data = buildReportData({ incomes, expenses, cards, categories, today })

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2
  const bottomLimit = pageHeight - MARGIN - FOOTER_SPACE
  let y = MARGIN

  doc.setFontSize(TAG_FONT_SIZE)
  const tagWidth = doc.getTextWidth(TAG_TEXT) + 8

  // ---------- primitivas de desenho ----------

  function ensureSpace(requiredHeight: number): void {
    if (y + requiredHeight > bottomLimit) {
      doc.addPage()
      y = MARGIN
    }
  }

  function text(
    value: string,
    x: number,
    baseline: number,
    options: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' } = {},
  ): void {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
    doc.setFontSize(options.size ?? 10)
    doc.setTextColor(...(options.color ?? INK))
    doc.text(value, x, baseline, { align: options.align ?? 'left' })
  }

  /** Corta o texto com reticências para caber na largura. */
  function fit(value: string, maxWidth: number, size: number, bold = false): string {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    if (doc.getTextWidth(value) <= maxWidth) return value
    let shortened = value
    while (shortened.length > 1 && doc.getTextWidth(`${shortened}…`) > maxWidth) {
      shortened = shortened.slice(0, -1)
    }
    return `${shortened.trimEnd()}…`
  }

  function hairline(atY: number): void {
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, atY, MARGIN + contentWidth, atY)
  }

  function sectionTitle(title: string, right?: string): void {
    ensureSpace(46)
    text(title, MARGIN, y + 12, { size: 14, bold: true })
    if (right) text(right, MARGIN + contentWidth, y + 12, { size: 11, bold: true, align: 'right' })
    y += 20
    hairline(y)
    y += 12
  }

  function emptyMessage(message: string): void {
    ensureSpace(24)
    text(message, MARGIN, y + 10, { size: 10, color: MUTED })
    y += 28
  }

  // ---------- página 1: resumo ----------

  function drawHeader(): void {
    text('SimpleFlow', MARGIN, y + 16, { size: 20, bold: true, color: BRAND })
    text('Relatório financeiro', MARGIN + contentWidth, y + 16, {
      size: 11,
      color: MUTED,
      align: 'right',
    })
    y += 28
    hairline(y)
    y += 18
    text(formatPeriod(period), MARGIN, y + 6, { size: 17, bold: true })
    text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, MARGIN + contentWidth, y + 6, {
      size: 9,
      color: MUTED,
      align: 'right',
    })
    y += 28
  }

  function drawStatCards(): void {
    const gap = 10
    const width = (contentWidth - gap * 3) / 4
    const height = 50
    const balanceColor = data.totals.balance >= 0 ? INCOME_COLOR : EXPENSE_COLOR
    const stats: { label: string; value: number; color: RGB }[] = [
      { label: 'Entradas', value: data.totals.income, color: INCOME_COLOR },
      { label: 'Saídas à vista', value: data.totals.cashExpenses, color: EXPENSE_COLOR },
      { label: 'Faturas dos cartões', value: data.totals.invoices, color: INVOICE_COLOR },
      { label: 'Saldo do período', value: data.totals.balance, color: balanceColor },
    ]

    stats.forEach((stat, index) => {
      const x = MARGIN + index * (width + gap)
      doc.setFillColor(...SURFACE)
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.6)
      doc.roundedRect(x, y, width, height, 4, 4, 'FD')
      doc.setFillColor(...stat.color)
      doc.rect(x, y + 6, 3, height - 12, 'F')
      text(stat.label, x + 12, y + 18, { size: 8, color: MUTED })
      text(formatCurrency(stat.value), x + 12, y + 38, { size: 12, bold: true, color: stat.color })
    })
    y += height + 6
    text('Saldo = entradas – saídas à vista – faturas dos cartões.', MARGIN, y + 8, {
      size: 7.5,
      color: MUTED,
    })
    y += 24
  }

  function drawStatusRow(): void {
    text('Situação das saídas à vista', MARGIN, y + 8, { size: 10, bold: true })
    y += 16
    const gap = 10
    const width = (contentWidth - gap * 2) / 3
    const height = 38
    const items = [
      { label: 'Pago', total: data.status.paid, color: PAID_COLOR },
      { label: 'Pendente', total: data.status.pending, color: PENDING_COLOR },
      { label: EXPENSE_OVERDUE_LABEL, total: data.status.overdue, color: OVERDUE_COLOR },
    ]

    items.forEach((item, index) => {
      const x = MARGIN + index * (width + gap)
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.6)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x, y, width, height, 4, 4, 'FD')
      doc.setFillColor(...item.color)
      doc.circle(x + 12, y + 13, 3, 'F')
      text(item.label, x + 21, y + 16, { size: 8.5, bold: true })
      const count = `${item.total.count} ${item.total.count === 1 ? 'saída' : 'saídas'}`
      text(count, x + width - 10, y + 16, { size: 8, color: MUTED, align: 'right' })
      text(formatCurrency(item.total.amount), x + 12, y + 31, {
        size: 10.5,
        bold: true,
        color: item.color,
      })
    })
    y += height + 22
  }

  /** Barras horizontais, desenhadas com retângulos (nada de imagem nem Chart.js). */
  function drawBars(title: string, bars: CategoryBar[], x: number, width: number): number {
    let cursor = y
    text(title, x, cursor + 8, { size: 10, bold: true })
    cursor += 18

    if (!bars.length) {
      text('Sem lançamentos no período.', x, cursor + 8, { size: 9, color: MUTED })
      return cursor + 22
    }

    const shown = limitBars(bars)
    const max = Math.max(...shown.map((bar) => bar.total), 1)
    const valueWidth = 62

    for (const bar of shown) {
      text(fit(bar.name, width - valueWidth - 6, 8.5), x, cursor + 7, { size: 8.5 })
      text(formatCurrency(bar.total), x + width, cursor + 7, {
        size: 8.5,
        bold: true,
        align: 'right',
      })
      doc.setFillColor(...BORDER)
      doc.roundedRect(x, cursor + 11, width, 5, 2.5, 2.5, 'F')
      doc.setFillColor(...hexToRgb(bar.color))
      doc.roundedRect(x, cursor + 11, Math.max(3, (bar.total / max) * width), 5, 2.5, 2.5, 'F')
      cursor += 25
    }
    return cursor
  }

  function drawBarsRow(): void {
    ensureSpace(200)
    const gap = 24
    const width = (contentWidth - gap) / 2
    const left = drawBars('Entradas por categoria', data.incomeBars, MARGIN, width)
    const right = drawBars(
      'Saídas por categoria (à vista + cartão)',
      data.expenseBars,
      MARGIN + width + gap,
      width,
    )
    y = Math.max(left, right) + 12
  }

  /** Um setor de anel: polígono aproximando o arco, preenchido com as primitivas do jsPDF. */
  function drawRingSlice(
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    startAngle: number,
    endAngle: number,
    color: RGB,
  ): void {
    const steps = Math.max(2, Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * 120))
    const points: [number, number][] = []
    for (let i = 0; i <= steps; i += 1) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps
      points.push([cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer])
    }
    for (let i = steps; i >= 0; i -= 1) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps
      points.push([cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner])
    }

    const [first, ...rest] = points
    if (!first) return
    const deltas = rest.map(([px, py], index) => {
      const [prevX, prevY] = index === 0 ? first : rest[index - 1]!
      return [px - prevX, py - prevY]
    })
    doc.setFillColor(...color)
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.8)
    doc.lines(deltas, first[0], first[1], [1, 1], 'FD', true)
  }

  function drawTypeDonut(slices: TypeSlice[]): void {
    const legendRow = 15
    const blockHeight = Math.max(130, slices.length * legendRow + 8)
    ensureSpace(blockHeight + 40)

    text('Saídas por tipo (à vista + cartão)', MARGIN, y + 8, { size: 10, bold: true })
    y += 20

    if (!slices.length) {
      emptyMessage('Sem saídas no período.')
      return
    }

    const outer = 56
    const inner = 34
    const cx = MARGIN + outer + 6
    const cy = y + outer + 4
    const total = slices.reduce((sum, slice) => sum + slice.total, 0)

    let angle = -Math.PI / 2
    for (const slice of slices) {
      const span = (slice.total / total) * Math.PI * 2
      drawRingSlice(cx, cy, outer, inner, angle, angle + span, hexToRgb(slice.color))
      angle += span
    }
    text('Total', cx, cy - 2, { size: 7.5, color: MUTED, align: 'center' })
    text(formatCurrency(total), cx, cy + 9, { size: 8, bold: true, align: 'center' })

    const legendX = MARGIN + outer * 2 + 40
    const legendWidth = MARGIN + contentWidth - legendX
    let legendY = y + 6
    for (const slice of slices) {
      doc.setFillColor(...hexToRgb(slice.color))
      doc.roundedRect(legendX, legendY - 1, 8, 8, 2, 2, 'F')
      text(slice.label, legendX + 14, legendY + 6, { size: 8.5 })
      text(`${slice.percent.toFixed(1).replace('.', ',')}%`, legendX + legendWidth - 78, legendY + 6, {
        size: 8.5,
        color: MUTED,
        align: 'right',
      })
      text(formatCurrency(slice.total), legendX + legendWidth, legendY + 6, {
        size: 8.5,
        bold: true,
        align: 'right',
      })
      legendY += legendRow
    }
    y += blockHeight
  }

  // ---------- páginas de detalhe ----------

  /** Estilos comuns das tabelas de detalhe. */
  function baseTable(startY: number) {
    return {
      startY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + FOOTER_SPACE },
      theme: 'plain' as const,
      // O subtotal/total só no fim da tabela; por padrão o rodapé se repetiria a cada página.
      showFoot: 'lastPage' as const,
      styles: {
        fontSize: 8,
        textColor: INK,
        cellPadding: 3,
        lineColor: BORDER,
        lineWidth: { bottom: 0.5 },
        overflow: 'linebreak' as const,
      },
      headStyles: {
        fillColor: SURFACE,
        textColor: MUTED,
        fontStyle: 'bold' as const,
        lineWidth: { bottom: 0.8 },
      },
      footStyles: {
        fillColor: SURFACE,
        textColor: INK,
        fontStyle: 'bold' as const,
        lineWidth: 0,
      },
    }
  }

  /** Desenha a etiqueta "Recorrente" na linha extra dos lançamentos recorrentes. */
  function drawTag(tagRows: Set<number>) {
    return (hook: CellHookData): void => {
      if (hook.section !== 'body' || hook.column.index !== 0 || !tagRows.has(hook.row.index)) return
      const x = hook.cell.x + 3
      const top = hook.cell.y + 1
      hook.doc.setFillColor(...SURFACE)
      hook.doc.setDrawColor(...BORDER)
      hook.doc.setLineWidth(0.5)
      hook.doc.roundedRect(x, top, tagWidth, 8.5, 2, 2, 'FD')
      hook.doc.setFont('helvetica', 'bold')
      hook.doc.setFontSize(TAG_FONT_SIZE)
      hook.doc.setTextColor(...MUTED)
      hook.doc.text(TAG_TEXT, x + tagWidth / 2, top + 6, { align: 'center' })
    }
  }

  function groupHeading(group: ReportGroup<unknown>): void {
    ensureSpace(70)
    doc.setFillColor(...hexToRgb(group.color))
    doc.roundedRect(MARGIN, y + 1, 8, 8, 2, 2, 'F')
    text(group.name, MARGIN + 14, y + 9, { size: 10, bold: true })
    const count = `${group.items.length} ${group.items.length === 1 ? 'lançamento' : 'lançamentos'}`
    text(count, MARGIN + contentWidth, y + 9, { size: 8, color: MUTED, align: 'right' })
    y += 16
  }

  function totalBar(label: string, value: number, color: RGB): void {
    ensureSpace(30)
    doc.setFillColor(...SURFACE)
    doc.setDrawColor(...color)
    doc.setLineWidth(0.8)
    doc.roundedRect(MARGIN, y, contentWidth, 24, 4, 4, 'FD')
    text(label, MARGIN + 12, y + 15.5, { size: 10, bold: true })
    text(formatCurrency(value), MARGIN + contentWidth - 12, y + 15.5, {
      size: 11,
      bold: true,
      color,
      align: 'right',
    })
    y += 38
  }

  function drawIncomeSection(): void {
    sectionTitle('Entradas', formatCurrency(data.totals.income))
    if (!data.incomeGroups.length) {
      emptyMessage('Nenhuma entrada no período.')
      return
    }

    const columns = 4
    for (const group of data.incomeGroups) {
      groupHeading(group)
      const { rows, tagRows } = buildRows<Income>(
        group.items,
        columns,
        (item) => [
          formatDate(item.date),
          item.description,
          INCOME_TYPE_LABEL[item.type] ?? '—',
          formatCurrency(item.amount),
        ],
        tagWidth,
      )
      autoTable(doc, {
        ...baseTable(y),
        head: [['Data', 'Descrição', 'Tipo', 'Valor']],
        body: rows,
        foot: [
          [
            { content: `Subtotal – ${group.name}`, colSpan: 3, styles: { halign: 'right' } },
            { content: formatCurrency(group.total), styles: { halign: 'right' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 52 },
          2: { cellWidth: 80 },
          3: { cellWidth: 78, halign: 'right' },
        },
        didDrawCell: drawTag(tagRows),
      })
      y = finalY(doc) + 16
    }
    totalBar('Total de entradas', data.totals.income, INCOME_COLOR)
  }

  function drawExpenseSection(): void {
    sectionTitle('Saídas à vista', formatCurrency(data.totals.cashExpenses))
    if (!data.expenseGroups.length) {
      emptyMessage('Nenhuma saída à vista no período.')
      return
    }

    const columns = 8
    for (const group of data.expenseGroups) {
      groupHeading(group)
      const { rows, tagRows, mainRowItem } = buildRows<Expense>(
        group.items,
        columns,
        (item) => [
          formatDate(item.date),
          item.description,
          EXPENSE_TYPE_LABEL[item.type] ?? '—',
          PAYMENT_METHOD_LABEL[item.paymentMethod],
          formatDate(item.dueDate),
          formatDate(item.paidAt),
          expenseStatusText(item, today).text,
          formatCurrency(item.amount),
        ],
        tagWidth,
      )
      autoTable(doc, {
        ...baseTable(y),
        head: [['Data', 'Descrição', 'Tipo', 'Pagamento', 'Vencim.', 'Pago em', 'Situação', 'Valor']],
        body: rows,
        foot: [
          [
            { content: `Subtotal – ${group.name}`, colSpan: 7, styles: { halign: 'right' } },
            { content: formatCurrency(group.total), styles: { halign: 'right' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 46 },
          2: { cellWidth: 52 },
          3: { cellWidth: 52 },
          4: { cellWidth: 46 },
          5: { cellWidth: 46 },
          6: { cellWidth: 44 },
          7: { cellWidth: 60, halign: 'right' },
        },
        didParseCell: (hook) => {
          if (hook.section !== 'body' || hook.column.index !== 6) return
          const item = mainRowItem.get(hook.row.index)
          if (!item) return
          hook.cell.styles.textColor = expenseStatusText(item, today).color
          hook.cell.styles.fontStyle = 'bold'
        },
        didDrawCell: drawTag(tagRows),
      })
      y = finalY(doc) + 16
    }
    totalBar('Total de saídas à vista', data.totals.cashExpenses, EXPENSE_COLOR)
  }

  function drawCardBlock({ card, invoice }: CreditCardWithInvoice): void {
    ensureSpace(90)
    const height = 40
    const accent = hexToRgb(card.color)

    doc.setFillColor(...SURFACE)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.6)
    doc.roundedRect(MARGIN, y, contentWidth, height, 4, 4, 'FD')
    doc.setFillColor(...accent)
    doc.rect(MARGIN, y + 6, 3, height - 12, 'F')

    text(`${card.name} (•••• ${card.lastDigits})`, MARGIN + 14, y + 16, { size: 10.5, bold: true })

    if (!invoice) {
      text('Sem fatura no período', MARGIN + 14, y + 31, { size: 8.5, color: MUTED })
      y += height + 14
      return
    }

    text(
      `Vencimento ${formatDate(invoice.dueDate)}  ·  Fecha em ${formatDate(invoice.closingDate)}  ·  Situação: ${INVOICE_STATUS_LABEL[invoice.status]}`,
      MARGIN + 14,
      y + 31,
      { size: 8.5, color: MUTED },
    )
    text('Total da fatura', MARGIN + contentWidth - 12, y + 15, {
      size: 7.5,
      color: MUTED,
      align: 'right',
    })
    text(formatCurrency(invoice.total), MARGIN + contentWidth - 12, y + 31, {
      size: 11,
      bold: true,
      color: INVOICE_COLOR,
      align: 'right',
    })
    y += height + 6

    if (!invoice.transactions.length) {
      emptyMessage('Nenhuma transação nesta fatura.')
      return
    }

    const columns = 6
    const transactions = invoice.transactions.slice().sort((a, b) => a.date.localeCompare(b.date))
    const { rows, tagRows } = buildRows(
      transactions,
      columns,
      (item) => [
        formatDate(item.date),
        item.description,
        categoryLabel(item.categoryId),
        EXPENSE_TYPE_LABEL[item.type] ?? '—',
        installmentText(item.installment, item.totalInstallments),
        formatCurrency(item.amount),
      ],
      tagWidth,
    )
    autoTable(doc, {
      ...baseTable(y),
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Parcela', 'Valor']],
      body: rows,
      foot: [
        [
          { content: 'Total da fatura', colSpan: 5, styles: { halign: 'right' } },
          { content: formatCurrency(invoice.total), styles: { halign: 'right' } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 52 },
        2: { cellWidth: 90 },
        3: { cellWidth: 62 },
        4: { cellWidth: 44, halign: 'center' },
        5: { cellWidth: 70, halign: 'right' },
      },
      didDrawCell: drawTag(tagRows),
    })
    y = finalY(doc) + 18
  }

  function categoryLabel(id: string): string {
    return categories.find((category) => category.id === id)?.name ?? 'Sem categoria'
  }

  function drawCardSection(): void {
    sectionTitle('Cartões de crédito', formatCurrency(data.totals.invoices))
    if (!data.cards.length) {
      emptyMessage('Nenhum cartão cadastrado.')
      return
    }
    for (const entry of data.cards) drawCardBlock(entry)
    totalBar('Total das faturas', data.totals.invoices, INVOICE_COLOR)
  }

  /** "Página X de Y" e o nome do relatório em todas as páginas, depois de saber o total. */
  function drawFooters(): void {
    const total = doc.getNumberOfPages()
    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page)
      hairline(pageHeight - MARGIN - 8)
      text(`SimpleFlow · Relatório de ${formatPeriod(period)}`, MARGIN, pageHeight - MARGIN + 6, {
        size: 8,
        color: MUTED,
      })
      text(`Página ${page} de ${total}`, MARGIN + contentWidth, pageHeight - MARGIN + 6, {
        size: 8,
        color: MUTED,
        align: 'right',
      })
    }
  }

  drawHeader()
  drawStatCards()
  drawStatusRow()
  drawBarsRow()
  drawTypeDonut(data.typeSlices)

  doc.addPage()
  y = MARGIN
  drawIncomeSection()
  drawExpenseSection()
  drawCardSection()
  drawFooters()

  // O nome do arquivo aparece para o usuário, por isso continua em português.
  doc.save(`relatorio-simpleflow-${toReferenceMonth(period)}.pdf`)
}
