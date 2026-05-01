interface LineChartProps {
  data: Array<{ label: string | number; value: number }>
  title: string
  color?: string
}

export function LineChart({ data, title, color = '#4f46e5' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Sem dados para exibir
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 0)
  const minValue = Math.min(...data.map((d) => d.value), 0)
  const range = maxValue - minValue || 1

  const width = 500
  const height = 250
  const padding = 40
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2

  // Generate points
  const points = data.map((item, idx) => {
    const x = padding + (plotWidth / (data.length - 1 || 1)) * idx
    const y = padding + plotHeight - ((item.value - minValue) / range) * plotHeight
    return { x, y, ...item }
  })

  // Generate path
  const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="w-full">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <svg width={width + padding * 2} height={height + padding * 2} className="mx-auto">
          {/* Axes */}
          <line
            x1={padding}
            y1={height + padding}
            x2={width + padding}
            y2={height + padding}
            stroke="#ddd"
            strokeWidth={1}
          />
          <line x1={padding} y1={padding} x2={padding} y2={height + padding} stroke="#ddd" strokeWidth={1} />

          {/* Grid lines */}
          {Array(5)
            .fill(0)
            .map((_, idx) => {
              const y = padding + (plotHeight / 4) * idx
              return (
                <line
                  key={idx}
                  x1={padding}
                  y1={y}
                  x2={width + padding}
                  y2={y}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                  strokeDasharray="4"
                />
              )
            })}

          {/* Line */}
          <path d={pathData} fill="none" stroke={color} strokeWidth={2} />

          {/* Points and labels */}
          {points.map((point, idx) => (
            <g key={idx}>
              {/* Vertical guide line on hover area */}
              <rect
                x={point.x - plotWidth / (data.length * 2)}
                y={padding}
                width={plotWidth / data.length}
                height={plotHeight}
                fill="transparent"
              />

              {/* Point */}
              <circle cx={point.x} cy={point.y} r={3} fill={color} />

              {/* Label */}
              <text
                x={point.x}
                y={height + padding + 20}
                textAnchor="middle"
                className="text-xs text-gray-600"
                fontSize={11}
              >
                {point.label}
              </text>

              {/* Value label on point */}
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                className="text-xs font-bold text-gray-900"
                fontSize={10}
              >
                {point.value}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
