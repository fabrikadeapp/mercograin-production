import { PageHeader, Card } from '@/components/ui/phb'
import { ImportarClientes } from './_ui'

export const dynamic = 'force-dynamic'

export default function ImportarPage() {
  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Importar dados" subtitle="Importação CSV de clientes (preview + commit)" />
      <Card className="p-4 mt-4">
        <ImportarClientes />
      </Card>
      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Formato esperado</h3>
        <p className="text-xs opacity-70 mb-2">
          Arquivo CSV com header. Delimitador <code>,</code> <code>;</code> ou tab é auto-detectado.
        </p>
        <p className="text-xs opacity-70 mb-1">Colunas reconhecidas (sinônimos aceitos):</p>
        <ul className="text-xs opacity-70 list-disc pl-5 space-y-0.5">
          <li><strong>nome</strong> (obrigatória): Nome | Cliente | Razão Social | Name</li>
          <li>tipo: comprador | vendedor | ambos (default: ambos)</li>
          <li>email, whatsapp, telefone, endereço</li>
          <li>cnpj — validado por dígito verificador</li>
          <li>cpf — validado por dígito verificador</li>
        </ul>
        <p className="text-xs opacity-60 mt-2">
          Duplicatas (mesmo CNPJ/CPF já cadastrado no workspace) são puladas no commit.
        </p>
      </Card>
    </div>
  )
}
