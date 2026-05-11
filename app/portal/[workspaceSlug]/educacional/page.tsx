const ARTIGOS = [
  {
    titulo: 'O que é fixação de preço?',
    resumo:
      'Fixar preço significa travar hoje o valor que você receberá por sacas que serão entregues no futuro. Protege contra queda de preço, mas remove o ganho em caso de alta. Avalie sua exposição antes de fixar 100%.',
  },
  {
    titulo: 'Contrato a fixar vs. contrato com preço',
    resumo:
      'No contrato a fixar você entrega o grão e depois decide quando travar o preço (até a data limite). No contrato com preço, o valor já está definido na assinatura. Cada um tem tributação e risco distintos.',
  },
  {
    titulo: 'Hedge com mini-contratos B3 e CBOT',
    resumo:
      'Hedge é uma operação no mercado futuro que neutraliza risco de preço. Produtores médios usam mini-contratos (CCM, ICF) ou ETFs. Importante: hedge não maximiza lucro, ele reduz volatilidade.',
  },
  {
    titulo: 'Barter: trocando grão por insumos',
    resumo:
      'No barter você troca sacas futuras por insumos hoje. Útil pra capital de giro, mas atenção à relação de troca (sacas por unidade de insumo) e à variação cambial em fertilizantes importados.',
  },
  {
    titulo: 'Checklist antes de assinar um contrato com a corretora',
    resumo:
      'Confira: 1) volume, 2) qualidade/padrão de classificação, 3) local de entrega, 4) data limite de fixação, 5) condições de pagamento, 6) prêmios e descontos, 7) cláusula de força maior, 8) tributação aplicada.',
  },
]

export default function EducacionalPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Aprenda</h1>
      <p className="text-sm text-gray-500">Conteúdo curto pra você entender melhor o mercado.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {ARTIGOS.map((a) => (
          <article key={a.titulo} className="rounded-lg border bg-white p-4">
            <h2 className="font-medium">{a.titulo}</h2>
            <p className="mt-2 text-sm text-gray-700">{a.resumo}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
