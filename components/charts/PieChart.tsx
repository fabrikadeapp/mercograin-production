interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>
  title: string
}

export function PieChart({ data, title }: PieChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Sem dados para exibir
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Sem dados para exibir
      </div>
    )
  }

  const centerX = 100
  const centerY = 100
  const radius = 80

  let currentAngle = -Math.PI / 2

  const paths = data.map((item, idx) => {
    const sliceAngle = (item.value / total) * Math.PI * 2
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle

    const x1 = centerX + radius * Math.cos(startAngle)
    const y1 = centerY + radius * Math.sin(startAngle)
    const x2 = centerX + radius * Math.cos(endAngle)
    const y2 = centerY + radius * Math.sin(endAngle)

    const largeArc = sliceAngle > Math.PI ? 1 : 0

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ')

    const labelAngle = startAngle + sliceAngle / 2
    const labelRadius = radius * 0.65
    const labelX = centerX + labelRadius * Math.cos(labelAngle)
    const labelY = centerY + labelRadius * Math.sin(labelAngle)

    const percentage = Math.round((item.value / total) * 100)

    currentAngle = endAngle

    return { pathData, labelX, labelY, percentage, ...item }
  })

  return (
    <div className="w-full">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="flex gap-8">
        <svg width={220} height={220} className="flex-shrink-0">
          {paths.map((path, idx) => (
            <g key={idx}>
              <path d={path.pathData} fill={path.color} opacity={0.8} />
              {path.percentage > 5 && (
                <text
                  x={path.labelX}
                  y={path.labelY}
                  textAnchor="middle"
                  className="text-xs font-bold text-white"
                  fontSize={11}
                >
                  {path.percentage}%
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className="flex flex-col justify-center gap-2">
          {paths.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-gray-700">{item.label}</span>
              <span className="text-gray-500 ml-auto">
                {item.percentage}% ({item.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
