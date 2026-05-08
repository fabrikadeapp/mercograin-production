/**
 * Sparkline data via Yahoo Finance daily chart.
 * Returns ~20-22 closes for the last ~30 calendar days.
 * Fails gracefully (returns []) so the UI can still render.
 */
import yahooFinance from 'yahoo-finance2'

export async function fetchSparkline(symbol: string, days = 30): Promise<number[]> {
  try {
    const period2 = new Date()
    const period1 = new Date(period2.getTime() - days * 24 * 60 * 60 * 1000)

    const result: any = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: '1d',
    })

    const quotes = result?.quotes || []
    const closes: number[] = []
    for (const q of quotes) {
      const c = q?.close
      if (typeof c === 'number' && Number.isFinite(c)) closes.push(c)
    }
    return closes
  } catch (e: any) {
    console.warn(`[yahoo] sparkline ${symbol} failed: ${e?.message || e}`)
    return []
  }
}
