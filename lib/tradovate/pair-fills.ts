export type FillInput = {
  id: number
  contractId: number
  action: 'Buy' | 'Sell'
  qty: number
  price: number
  time: number
}

export type RoundTrip = {
  id: string
  contractId: number
  side: 'Long' | 'Short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  closedAt: string
}

type OpenLot = {
  fillId: number
  action: 'Buy' | 'Sell'
  price: number
  qty: number
  time: number
}

export function pairFills(
  fills: FillInput[],
  multiplierFor: (contractId: number) => number | null,
): { trips: RoundTrip[]; unpricedContractIds: number[] } {
  const contractIds = [...new Set(fills.map(fill => fill.contractId))]
  const trips: RoundTrip[] = []
  const unpricedContractIds: number[] = []

  for (const contractId of contractIds) {
    const multiplier = multiplierFor(contractId)
    if (multiplier == null || !(multiplier > 0)) {
      unpricedContractIds.push(contractId)
      continue
    }

    const lots: OpenLot[] = []
    const ordered = fills
      .filter(fill => fill.contractId === contractId && fill.qty > 0 && (fill.action === 'Buy' || fill.action === 'Sell'))
      .sort((a, b) => a.time - b.time || a.id - b.id)

    for (const fill of ordered) {
      let remaining = fill.qty
      while (remaining > 0 && lots.length > 0 && lots[0].action !== fill.action) {
        const lot = lots[0]
        const matched = Math.min(remaining, lot.qty)
        const side = lot.action === 'Buy' ? 'Long' : 'Short'
        const points = side === 'Long' ? fill.price - lot.price : lot.price - fill.price
        trips.push({
          id: `${contractId}-${lot.fillId}-${fill.id}-${trips.length}`,
          contractId,
          side,
          quantity: matched,
          entryPrice: lot.price,
          exitPrice: fill.price,
          pnl: points * matched * multiplier,
          closedAt: new Date(fill.time).toISOString(),
        })
        lot.qty -= matched
        remaining -= matched
        if (lot.qty <= 0) lots.shift()
      }
      if (remaining > 0) {
        lots.push({ fillId: fill.id, action: fill.action, price: fill.price, qty: remaining, time: fill.time })
      }
    }
  }

  trips.sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))
  return { trips, unpricedContractIds }
}
