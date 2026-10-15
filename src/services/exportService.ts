import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import type { PageRequest, Paginated, Period } from '@/types/common'
import { INVOICE_STATUS_LABEL } from '@/types/creditCard'
import { EXPENSE_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '@/types/expense'
import { INCOME_TYPE_LABEL } from '@/types/income'
import { categoryService } from './categoryService'
import { creditCardService } from './creditCardService'
import { expenseService } from './expenseService'
import { incomeService } from './incomeService'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, formatPeriod, toReferenceMonth } from '@/utils/dateFormatter'

const MARGIN = 40
/*
 * Decisão (issue #81): o PDF mantém a Helvetica embutida do jsPDF em vez de Montserrat.
 * Usar Montserrat exigiria embutir os arquivos TTF convertidos em base64 (addFileToVFS/addFont),
 * aumentando o bundle em centenas de KB por peso, por ganho apenas estético num relatório.
 */
/** Maior `pageSize` aceito pela API (`max(100)` nos schemas de listagem do backend). */
const PAGE_SIZE = 100

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

/** Gera e baixa um PDF com entradas, saídas e cartões do período informado. */
export async function exportPdfReport(period: Period): Promise<void> {
  const [incomes, expenses, cards, categories] = await Promise.all([
    listAll((page) => incomeService.list({ period, ...page })),
    listAll((page) => expenseService.list({ period, ...page })),
    creditCardService.listWithInvoices({ period }),
    categoryService.list(),
  ])

  const categoryName = (id: string): string =>
    categories.find((category) => category.id === id)?.name ?? 'Sem categoria'

  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0)
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = MARGIN

  function ensureSpace(requiredHeight: number): void {
    if (y + requiredHeight > pageHeight - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  function sectionTitle(text: string): void {
    ensureSpace(30)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(text, MARGIN, y)
    y += 18
  }

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('SimpleFlow — Relatório financeiro', MARGIN, y)
  y += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(formatPeriod(period), MARGIN, y)
  y += 14
  doc.setTextColor(120)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, MARGIN, y)
  doc.setTextColor(0)
  y += 26

  sectionTitle('Resumo')
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 10 },
    body: [
      ['Total de entradas', formatCurrency(totalIncome)],
      ['Total de saídas', formatCurrency(totalExpenses)],
      ['Saldo do período', formatCurrency(totalIncome - totalExpenses)],
    ],
  })
  y = finalY(doc) + 26

  sectionTitle('Entradas')
  if (incomes.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: incomes.map((item) => [
        formatDate(item.date),
        item.description,
        categoryName(item.categoryId),
        INCOME_TYPE_LABEL[item.type] ?? '—',
        formatCurrency(item.amount),
      ]),
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
      columnStyles: { 4: { halign: 'right' } },
    })
    y = finalY(doc) + 26
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhuma entrada no período.', MARGIN, y)
    doc.setTextColor(0)
    y += 26
  }

  sectionTitle('Saídas')
  if (expenses.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Situação', 'Valor']],
      body: expenses.map((item) => [
        formatDate(item.date),
        item.description,
        categoryName(item.categoryId),
        PAYMENT_METHOD_LABEL[item.paymentMethod],
        EXPENSE_STATUS_LABEL[item.status],
        formatCurrency(item.amount),
      ]),
      headStyles: { fillColor: [244, 63, 94] },
      styles: { fontSize: 9 },
      columnStyles: { 5: { halign: 'right' } },
    })
    y = finalY(doc) + 26
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhuma saída no período.', MARGIN, y)
    doc.setTextColor(0)
    y += 26
  }

  sectionTitle('Cartões de crédito')
  if (cards.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Cartão', 'Vencimento', 'Situação', 'Total da fatura']],
      body: cards.map(({ card, invoice }) => [
        `${card.name} (•••• ${card.lastDigits})`,
        invoice ? formatDate(invoice.dueDate) : '—',
        invoice ? INVOICE_STATUS_LABEL[invoice.status] : 'Sem fatura no período',
        invoice ? formatCurrency(invoice.total) : '—',
      ]),
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: 'right' } },
    })
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhum cartão cadastrado.', MARGIN, y)
    doc.setTextColor(0)
  }

  // O nome do arquivo aparece para o usuário, por isso continua em português.
  doc.save(`relatorio-simpleflow-${toReferenceMonth(period)}.pdf`)
}
