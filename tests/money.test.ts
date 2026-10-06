import { describe, expect, it } from 'vitest'
import * as utils from '../src/lib/utils'

const parse = (utils as unknown as { parseMoneyCents?: (value: string) => number | null }).parseMoneyCents

describe('exact decimal money entry', () => {
  it.each([
    ['0.29', 29], ['10', 1000], ['10.1', 1010], ['000.01', 1], [' 23.45 ', 2345],
    ['-1', null], ['1.001', null], ['1e3', null], ['', null], ['NaN', null],
    ['Infinity', null], ['90071992547409.92', null],
  ])('parses %s as integer cents without rounding', (value, expected) => {
    expect(parse?.(value)).toBe(expected)
  })
})
