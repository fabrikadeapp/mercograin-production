import { LandingNav } from '@/app/_landing/LandingNav'
import { Footer } from '@/app/_landing/Footer'
import { Card } from '@/components/ui/phb'

export const metadata = {
  title: 'Política de privacidade — PHB Grain',
  description:
    'Como o PHB Grain coleta, usa e protege seus dados em conformidade com a LGPD.',
}

const sectionH = 'text-h2 font-semibold text-fg-1 mt-10 mb-3'
const para = 'text-body text-fg-2 mb-4 leading-relaxed'
const list = 'list-disc pl-6 text-body text-fg-2 mb-4 space-y-2 leading-relaxed'

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-bg-0 text-fg-1">
      <LandingNav />

      <main>
        <section className="border-b border-border-1 bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-20 md:px-8 md:py-24">
            <p className="eyebrow mb-3 text-fg-3">Legal</p>
            <h1 className="mb-2 font-sans text-display font-semibold tracking-tight text-fg-1">
              Política de privacidade
            </h1>
            <p className="text-small text-fg-3">Última atualização: maio de 2026</p>
          </div>
        </section>

        <section className="bg-bg-0">
          <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-20">
            <Card className="p-8 md:p-10">
              <p className={para}>
                Esta Política descreve como a PHB Grain trata dados pessoais e dados
                de uso da plataforma, em conformidade com a Lei Geral de Proteção de
                Dados (Lei nº 13.709/2018 — &quot;LGPD&quot;).
              </p>

              <h2 className={sectionH}>1. Quais dados coletamos</h2>
              <ul className={list}>
                <li>
                  <strong className="text-fg-1">Dados de cadastro:</strong> nome,
                  email, dados da empresa e credenciais de autenticação.
                </li>
                <li>
                  <strong className="text-fg-1">Dados inseridos por você:</strong>{' '}
                  cadastros de clientes, contratos, propostas, fluxo de caixa e demais
                  registros operacionais.
                </li>
                <li>
                  <strong className="text-fg-1">Dados de uso:</strong> logs de acesso,
                  endereço IP, user-agent, eventos de auditoria e métricas técnicas.
                </li>
              </ul>

              <h2 className={sectionH}>2. Como usamos</h2>
              <ul className={list}>
                <li>Operar, manter e melhorar a plataforma.</li>
                <li>
                  Processar pagamentos via Stripe (subprocessador), incluindo
                  faturamento da assinatura.
                </li>
                <li>
                  Enviar emails transacionais (verificação de conta, faturas, alertas
                  operacionais).
                </li>
                <li>Cumprir obrigações legais e regulatórias.</li>
                <li>Investigar incidentes de segurança e fraudes.</li>
              </ul>

              <h2 className={sectionH}>3. Quem tem acesso</h2>
              <p className={para}>
                Acesso interno é restrito a funcionários autorizados da PHB Grain,
                sujeitos a controles de acesso baseados em papéis (RBAC) e termos de
                confidencialidade. Compartilhamos dados estritamente necessários com os
                seguintes processadores:
              </p>
              <ul className={list}>
                <li>
                  <strong className="text-fg-1">Stripe</strong> — processamento de
                  pagamentos.
                </li>
                <li>
                  <strong className="text-fg-1">Railway</strong> — hospedagem e
                  infraestrutura.
                </li>
                <li>
                  <strong className="text-fg-1">Resend / AWS SES</strong> — envio de
                  emails transacionais.
                </li>
                <li>
                  <strong className="text-fg-1">Twelve Data, CEPEA/ESALQ</strong> —
                  fontes de cotações de mercado.
                </li>
              </ul>

              <h2 className={sectionH}>4. Compartilhamento</h2>
              <p className={para}>
                A PHB Grain <strong className="text-fg-1">não vende</strong> dados
                pessoais. O compartilhamento ocorre apenas com os processadores
                listados acima, todos contratualmente vinculados a obrigações de
                proteção de dados, ou quando exigido por ordem judicial / autoridade
                competente.
              </p>

              <h2 className={sectionH}>5. Retenção</h2>
              <ul className={list}>
                <li>Dados ativos: enquanto a conta existir.</li>
                <li>Logs de uso e auditoria: 12 (doze) meses.</li>
                <li>Backups: até 90 (noventa) dias após o cancelamento da conta.</li>
                <li>
                  Dados fiscais/contábeis: pelo prazo exigido pela legislação
                  aplicável.
                </li>
              </ul>

              <h2 className={sectionH}>6. Seus direitos (LGPD)</h2>
              <p className={para}>
                Você tem direito a confirmar a existência de tratamento, acessar,
                corrigir, anonimizar, portar ou eliminar seus dados, bem como revogar
                consentimentos. Solicitações podem ser enviadas ao nosso Encarregado
                (DPO):{' '}
                <a href="mailto:dpo@phbgrain.com.br" className="text-accent underline">
                  dpo@phbgrain.com.br
                </a>
                .
              </p>

              <h2 className={sectionH}>7. Cookies</h2>
              <p className={para}>
                Utilizamos exclusivamente cookies necessários ao funcionamento do
                Serviço (sessão NextAuth e CSRF). Não empregamos cookies de
                rastreamento de terceiros para fins publicitários.
              </p>

              <h2 className={sectionH}>8. Segurança</h2>
              <p className={para}>
                Adotamos criptografia em trânsito (TLS) e em repouso, controle de
                acesso por papéis, isolamento de dados por workspace, registros
                imutáveis de auditoria e rotinas periódicas de revisão de
                vulnerabilidades. Nenhum sistema é totalmente imune a incidentes —
                comunicaremos titulares e a ANPD em caso de violação relevante, nos
                prazos legais.
              </p>

              <h2 className={sectionH}>9. Transferência internacional</h2>
              <p className={para}>
                Alguns processadores (Stripe e Railway) operam em servidores nos
                Estados Unidos. Nesses casos, a transferência ocorre com base em
                cláusulas contratuais padrão e garantias compatíveis com a LGPD.
              </p>

              <h2 className={sectionH}>10. Mudanças nesta política</h2>
              <p className={para}>
                Alterações materiais serão comunicadas por email aos titulares com
                antecedência mínima de 30 (trinta) dias. A versão vigente sempre
                estará disponível nesta página, com indicação da data da última
                atualização.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
