interface BarChartProps {
  data: Array<{ label: string; value: number }>
  title: string
  color?: string
}

export function BarChart({ data, title, color = '#3b82f6' }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Sem dados para exibir
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value))
  const height = 200
  const width = 400
  const barWidth = width / data.length / 1.5
  const padding = 40

  return (
    <div className="w-full">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <svg width={width + padding * 2} height={height + padding * 2} className="mx-auto">
          {/* Axes */}
          <line x1={padding} y1={height + padding} x2={width + padding} y2={height + padding} stroke="#ddd" />
          <line x1={padding} y1={padding} x2={padding} y2={height + padding} stroke="#ddd" />

          {/* Bars */}
          {data.map((item, idx) => {
            const barHeight = (item.value / maxValue) * height
            const x = padding + (width / data.length) * idx + (width / data.length - barWidth) / 2
            const y = height + padding - barHeight

            return (
              <g key={idx}>
                <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity={0.7} />
                <text
                  x={x + barWidth / 2}
                  y={height + padding + 20}
                  textAnchor="middle"
                  className="text-xs text-gray-600"
                  fontSize={11}
                >
                  {item.label}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-xs font-bold text-gray-900"
                  fontSize={11}
                >
                  {item.value}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
