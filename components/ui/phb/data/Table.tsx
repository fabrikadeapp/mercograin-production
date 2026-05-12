import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface DenseTableColumn<T> {
  key: string
  header: string
  accessor: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  isNumeric?: boolean
}

export interface DenseTableProps<T> {
  columns: DenseTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  className?: string
}

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

export function DenseTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: DenseTableProps<T>) {
  return (
    <div className={cn('card p-0 overflow-hidden', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-1">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-3 text-fg-3 text-micro uppercase tracking-wider font-semibold',
                  alignClass(col.align),
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-fg-3 text-center py-12 text-small"
              >
                {empty ?? 'Sem registros'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isLast = i === rows.length - 1
              return (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    !isLast && 'border-b border-border-1',
                    onRowClick && 'hover:bg-bg-3 transition cursor-pointer',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-5 py-3.5 text-fg-1 text-small',
                        alignClass(col.align),
                        col.isNumeric && 'font-mono tabular-nums',
                      )}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
