import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import type { Periodo } from '@/types/common'
import { FATURA_STATUS_LABEL } from '@/types/cartao'
import { FORMA_PAGAMENTO_LABEL, SAIDA_STATUS_LABEL } from '@/types/saida'
import { cartaoService } from './cartaoService'
import { categoriaService } from './categoriaService'
import { entradaService } from './entradaService'
import { formatCurrency } from '@/utils/currencyFormatter'
import { formatDate, formatPeriodo, toCompetencia } from '@/utils/dateFormatter'
import { saidaService } from './saidaService'

const MARGEM = 40
const LIMITE_ITENS = 1000

/** jspdf-autotable amplia `doc` em tempo de execução, mas não expõe o tipo. */
function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/** Gera e baixa um PDF com entradas, saídas e cartões do período informado. */
export async function exportarRelatorioPdf(periodo: Periodo): Promise<void> {
  const [entradas, saidas, cartoes, categorias] = await Promise.all([
    entradaService.listar({ periodo, page: 1, pageSize: LIMITE_ITENS }),
    saidaService.listar({ periodo, page: 1, pageSize: LIMITE_ITENS }),
    cartaoService.listarComFaturas({ periodo }),
    categoriaService.listar(),
  ])

  const nomeCategoria = (id: string): string =>
    categorias.find((categoria) => categoria.id === id)?.nome ?? 'Sem categoria'

  const totalEntradas = entradas.items.reduce((soma, item) => soma + item.valor, 0)
  const totalSaidas = saidas.items.reduce((soma, item) => soma + item.valor, 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const alturaPagina = doc.internal.pageSize.getHeight()
  let y = MARGEM

  function garantirEspaco(alturaNecessaria: number): void {
    if (y + alturaNecessaria > alturaPagina - MARGEM) {
      doc.addPage()
      y = MARGEM
    }
  }

  function tituloSecao(texto: string): void {
    garantirEspaco(30)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(texto, MARGEM, y)
    y += 18
  }

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('SimpleFlow — Relatório financeiro', MARGEM, y)
  y += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(formatPeriodo(periodo), MARGEM, y)
  y += 14
  doc.setTextColor(120)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, MARGEM, y)
  doc.setTextColor(0)
  y += 26

  tituloSecao('Resumo')
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM },
    theme: 'plain',
    styles: { fontSize: 10 },
    body: [
      ['Total de entradas', formatCurrency(totalEntradas)],
      ['Total de saídas', formatCurrency(totalSaidas)],
      ['Saldo do período', formatCurrency(totalEntradas - totalSaidas)],
    ],
  })
  y = finalY(doc) + 26

  tituloSecao('Entradas')
  if (entradas.items.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Data', 'Descrição', 'Categoria', 'Valor']],
      body: entradas.items.map((item) => [
        formatDate(item.data),
        item.descricao,
        nomeCategoria(item.categoriaId),
        formatCurrency(item.valor),
      ]),
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: 'right' } },
    })
    y = finalY(doc) + 26
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhuma entrada no período.', MARGEM, y)
    doc.setTextColor(0)
    y += 26
  }

  tituloSecao('Saídas')
  if (saidas.items.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Situação', 'Valor']],
      body: saidas.items.map((item) => [
        formatDate(item.data),
        item.descricao,
        nomeCategoria(item.categoriaId),
        FORMA_PAGAMENTO_LABEL[item.formaPagamento],
        SAIDA_STATUS_LABEL[item.status],
        formatCurrency(item.valor),
      ]),
      headStyles: { fillColor: [244, 63, 94] },
      styles: { fontSize: 9 },
      columnStyles: { 5: { halign: 'right' } },
    })
    y = finalY(doc) + 26
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhuma saída no período.', MARGEM, y)
    doc.setTextColor(0)
    y += 26
  }

  tituloSecao('Cartões de crédito')
  if (cartoes.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM },
      head: [['Cartão', 'Vencimento', 'Situação', 'Total da fatura']],
      body: cartoes.map(({ cartao, fatura }) => [
        `${cartao.nome} (•••• ${cartao.ultimosDigitos})`,
        fatura ? formatDate(fatura.vencimento) : '—',
        fatura ? FATURA_STATUS_LABEL[fatura.status] : 'Sem fatura no período',
        fatura ? formatCurrency(fatura.total) : '—',
      ]),
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: 'right' } },
    })
  } else {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Nenhum cartão cadastrado.', MARGEM, y)
    doc.setTextColor(0)
  }

  doc.save(`relatorio-simpleflow-${toCompetencia(periodo)}.pdf`)
}
