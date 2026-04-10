import { describe, it, expect } from 'vitest'

// Helper function from src/index.ts
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

describe('UUID Generation', () => {
  it('should generate a valid UUID', () => {
    const uuid = generateUUID()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID())
    }
    expect(uuids.size).toBe(1000)
  })

  it('should have version 4', () => {
    const uuid = generateUUID()
    expect(uuid.charAt(14)).toBe('4') // Version4
  })

  it('should have valid variant', () => {
    const uuid = generateUUID()
    const variant = uuid.charAt(19)
    expect(['8', '9', 'a', 'b']).toContain(variant)
  })
})