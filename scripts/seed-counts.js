const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  const models = ['workspace','subscription','dadosEmpresa','mesa','safra','armazem','cliente','fornecedor','corretor','motorista','propriedadeRural','talhao','balanca','centroCusto','configuracaoFiscal','proposta','contrato','contratoFixacao','fixacao','adiantamento','barterInsumo','planoVendas','washout','loteEstoque','romaneio','ordemCarga','taxaCambio','contratoFuturo','posicaoHedge','nDF','marcacaoMercado','alertaPreco','boleto','movimentoFinanceiro','comissaoRegra','comissaoApurada','royalty','notaFiscal','guia','oferta','cotacao','cenarioCalculadora','classificado','dueDiligenceStatement','listaSuja','auditLog']
  for (const m of models) {
    try {
      const c = await p[m].count()
      console.log(`${m.padEnd(28)} ${c}`)
    } catch (e) {
      console.log(`${m.padEnd(28)} ERR: ${e.message.slice(0, 40)}`)
    }
  }
  await p.$disconnect()
})()
