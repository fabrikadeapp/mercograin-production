import { calcularMetricas } from '@/lib/admin/metrics'
import { MetricasContent } from './_components/MetricasContent'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Layout pai (`app/admin/layout.tsx`) já valida session + role='admin'
// e redireciona, então não precisamos repetir aqui.
export default async function MetricasPage() {
  const metrics = await calcularMetricas()
  return <MetricasContent initialMetrics={metrics} />
}
