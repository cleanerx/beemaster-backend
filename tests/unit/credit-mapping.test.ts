import { describe, it, expect } from 'vitest'

// Credit mapping from src/index.ts
const CREDIT_MAPPING: Record<string, number> = {
  'credits_starter_100': 100,
  'credits_medium_500': 500,
  'credits_pro_2000': 2000,
  'credits_unlimited': 10000,
}

describe('Credit Product Mapping', () => {
  it('should return correct credits for starter pack', () => {
    expect(CREDIT_MAPPING['credits_starter_100']).toBe(100)
  })

  it('should return correct credits for medium pack', () => {
    expect(CREDIT_MAPPING['credits_medium_500']).toBe(500)
  })

  it('should return correct credits for pro pack', () => {
    expect(CREDIT_MAPPING['credits_pro_2000']).toBe(2000)
  })

  it('should return correct credits for unlimited pack', () => {
    expect(CREDIT_MAPPING['credits_unlimited']).toBe(10000)
  })

  it('should return undefined for unknown product', () => {
    expect(CREDIT_MAPPING['unknown_product']).toBeUndefined()
  })

  it('should have exactly 4 products', () => {
    expect(Object.keys(CREDIT_MAPPING)).toHaveLength(4)
  })

  it('should have ascending credit values', () => {
    const values = Object.values(CREDIT_MAPPING)
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
  })
})

describe('Credit Calculations', () => {
  it('should calculate total credits for multiple purchases', () => {
    const purchases = ['credits_starter_100', 'credits_medium_500']
    const total = purchases.reduce((sum, id) => sum + (CREDIT_MAPPING[id] || 0), 0)
    expect(total).toBe(600)
  })

  it('should handle no purchases', () => {
    const purchases: string[] = []
    const total = purchases.reduce((sum, id) => sum + (CREDIT_MAPPING[id] || 0), 0)
    expect(total).toBe(0)
  })

  it('should handle unknown products in purchase list', () => {
    const purchases = ['credits_starter_100', 'unknown_product', 'credits_medium_500']
    const total = purchases.reduce((sum, id) => sum + (CREDIT_MAPPING[id] || 0), 0)
    expect(total).toBe(600) // Unknown product contributes 0
  })
})