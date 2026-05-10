import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card } from '@/components/ui/phb'

export const metadata = {
  title: 'Termos de uso — BH Grain',
  description: 'Termos de uso da plataforma BH Grain.',
}

const sectionH = 'text-h2 font-semibold text-fg-1 mt-10 mb-3'
const para = 'text-body text-fg-2 mb-4 leading-relaxed'

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-20 md:px-8 md:py-24">
            <p className="eyebrow mb-3 text-fg-3">Legal</p>
            <h1 className="mb-2 font-sans text-display font-semibold tracking-tight text-fg-1">
              Termos de uso
            </h1>
            <p className="text-small text-fg-3">Última atualização: maio de 2026</p>
          </div>
        </section>

        <section className="bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-20">
            <Card className="p-8 md:p-10">
              <p className={para}>
                Estes Termos de Uso (&quot;Termos&quot;) regem o acesso e uso da plataforma
                BH Grain (&quot;Serviço&quot;), operada pela BH Grain, sociedade
                empresária constituída sob as leis da República Federativa do Brasil.
                Ao utilizar o Serviço, você concorda integralmente com estes Termos.
              </p>

              <h2 className={sectionH}>1. Objeto</h2>
              <p className={para}>
                O BH Grain é uma plataforma SaaS B2B voltada a tradings de grãos,
                oferecendo cotações de mercado, gestão de contratos, fluxo de caixa,
                integrações com WhatsApp e ferramentas correlatas. O Serviço é
                disponibilizado mediante assinatura recorrente.
              </p>

              <h2 className={sectionH}>2. Aceitação</h2>
              <p className={para}>
                O uso do Serviço, ainda que em período de avaliação (trial), implica
                aceitação destes Termos. Caso não concorde com qualquer cláusula, você
                deve interromper imediatamente o uso da plataforma.
              </p>

              <h2 className={sectionH}>3. Cadastro e conta</h2>
              <p className={para}>
                Você é integralmente responsável pela veracidade das informações
                prestadas no cadastro e pela guarda de suas credenciais. Atividades
                realizadas com seu login são presumidas como suas. Notifique-nos
                imediatamente em caso de uso não autorizado.
              </p>

              <h2 className={sectionH}>4. Plano e pagamento</h2>
              <p className={para}>
                Oferecemos trial de 10 (dez) dias com validação de cartão. A partir do
                11º dia, a assinatura é cobrada automaticamente em ciclos mensais
                recorrentes, conforme o plano escolhido. Não há fidelidade: o
                cancelamento pode ser realizado a qualquer momento e produz efeitos no
                fim do ciclo vigente, com possibilidade de reembolso pro-rata em casos
                de cobrança indevida. Os pagamentos são processados por intermédio de
                processador externo (Stripe).
              </p>

              <h2 className={sectionH}>5. Uso aceitável</h2>
              <p className={para}>
                É vedado: (i) realizar engenharia reversa, scraping ou extração
                automatizada de dados em violação aos limites técnicos do Serviço;
                (ii) usar o Serviço para fins ilícitos ou contrários à boa-fé; (iii)
                interferir na infraestrutura, segurança ou disponibilidade da
                plataforma; (iv) revender ou sublicenciar o acesso sem autorização
                expressa.
              </p>

              <h2 className={sectionH}>6. Propriedade intelectual</h2>
              <p className={para}>
                Todo o software, marca, layout, código-fonte e elementos visuais do
                Serviço são de titularidade exclusiva da BH Grain ou de seus
                licenciantes. Concedemos a você uma licença limitada, não exclusiva e
                revogável para uso conforme estes Termos.
              </p>

              <h2 className={sectionH}>7. Dados</h2>
              <p className={para}>
                Você é proprietário dos dados que insere no Serviço (clientes,
                contratos, propostas, etc.). A BH Grain não vende, aluga ou
                comercializa esses dados. Atuamos como operadora de dados nos termos da
                LGPD, sob suas instruções e finalidades estabelecidas. O tratamento de
                dados pessoais está detalhado em nossa{' '}
                <a href="/legal/privacidade" className="text-accent underline">
                  Política de Privacidade
                </a>
                .
              </p>

              <h2 className={sectionH}>8. Disponibilidade</h2>
              <p className={para}>
                Empenhamos esforços razoáveis para manter o Serviço disponível em
                regime &quot;best-effort&quot;. Os planos Pro e Enterprise possuem SLA
                de disponibilidade conforme tabela publicada na página de preços.
                Janelas de manutenção programada são comunicadas previamente.
              </p>

              <h2 className={sectionH}>9. Limitação de responsabilidade</h2>
              <p className={para}>
                Na máxima extensão permitida pela legislação aplicável, a BH Grain
                não responderá por danos indiretos, lucros cessantes, perda de
                oportunidade ou prejuízos decorrentes de decisões comerciais tomadas
                com base em dados exibidos pela plataforma. A responsabilidade total
                acumulada limita-se ao valor pago pelo cliente nos 12 (doze) meses
                anteriores ao evento.
              </p>

              <h2 className={sectionH}>10. Lei aplicável e foro</h2>
              <p className={para}>
                Estes Termos são regidos pelas leis da República Federativa do Brasil.
                Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer
                controvérsias, com renúncia a qualquer outro, por mais privilegiado
                que seja.
              </p>

              <h2 className={sectionH}>11. Contato</h2>
              <p className={para}>
                Dúvidas sobre estes Termos podem ser encaminhadas para{' '}
                <a href="mailto:contato@phbgrain.com.br" className="text-accent underline">
                  contato@phbgrain.com.br
                </a>
                .
              </p>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
