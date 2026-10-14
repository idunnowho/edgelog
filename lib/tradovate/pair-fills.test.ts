import assert from 'node:assert/strict'
import test from 'node:test'
import { pairFills } from './pair-fills'

const at = (iso: string) => Date.parse(iso)

test('pairs a long round trip with the contract multiplier', () => {
  const { trips } = pairFills([
    { id: 1, contractId: 10, action: 'Buy', qty: 2, price: 100, time: at('2026-10-01T14:30:00Z') },
    { id: 2, contractId: 10, action: 'Sell', qty: 2, price: 110, time: at('2026-10-01T14:35:00Z') },
  ], () => 5)

  assert.equal(trips.length, 1)
  assert.equal(trips[0].side, 'Long')
  assert.equal(trips[0].quantity, 2)
  assert.equal(trips[0].pnl, 100)
  assert.equal(trips[0].entryPrice, 100)
  assert.equal(trips[0].exitPrice, 110)
})

test('pairs a short and leaves the unclosed quantity off the journal', () => {
  const { trips } = pairFills([
    { id: 1, contractId: 4, action: 'Sell', qty: 3, price: 50, time: at('2026-10-02T15:00:00Z') },
    { id: 2, contractId: 4, action: 'Buy', qty: 1, price: 40, time: at('2026-10-02T15:05:00Z') },
  ], () => 20)

  assert.equal(trips.length, 1)
  assert.equal(trips[0].side, 'Short')
  assert.equal(trips[0].quantity, 1)
  assert.equal(trips[0].pnl, 200)
})

test('uses FIFO when scale-ins close together', () => {
  const { trips } = pairFills([
    { id: 1, contractId: 8, action: 'Buy', qty: 1, price: 100, time: at('2026-10-03T14:00:00Z') },
    { id: 2, contractId: 8, action: 'Buy', qty: 1, price: 102, time: at('2026-10-03T14:01:00Z') },
    { id: 3, contractId: 8, action: 'Sell', qty: 2, price: 110, time: at('2026-10-03T14:02:00Z') },
  ], () => 5)

  assert.deepEqual(trips.map(trip => trip.pnl).sort((a, b) => a - b), [40, 50])
})

test('skips contracts that have no point value', () => {
  const { trips, unpricedContractIds } = pairFills([
    { id: 1, contractId: 9, action: 'Buy', qty: 1, price: 10, time: at('2026-10-04T14:00:00Z') },
    { id: 2, contractId: 9, action: 'Sell', qty: 1, price: 12, time: at('2026-10-04T14:05:00Z') },
  ], () => null)

  assert.equal(trips.length, 0)
  assert.deepEqual(unpricedContractIds, [9])
})
