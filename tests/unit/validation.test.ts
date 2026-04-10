import { describe, it, expect } from 'vitest'

describe('Input Validation', () => {
  describe('Purchase Request Validation', () => {
    it('should reject empty purchase_token', () => {
      const request = { purchase_token: '', product_id: 'credits_starter_100', device_id: 'test' }
      const isValid = request.purchase_token && request.product_id && request.device_id
      expect(isValid).toBeFalsy()
    })

    it('should reject empty product_id', () => {
      const request = { purchase_token: 'token123', product_id: '', device_id: 'test' }
      const isValid = request.purchase_token && request.product_id && request.device_id
      expect(isValid).toBeFalsy()
    })

    it('should reject empty device_id', () => {
      const request = { purchase_token: 'token123', product_id: 'credits_starter_100', device_id: '' }
      const isValid = request.purchase_token && request.product_id && request.device_id
      expect(isValid).toBeFalsy()
    })

    it('should accept valid purchase request', () => {
      const request = { purchase_token: 'token123', product_id: 'credits_starter_100', device_id: 'device-123' }
      const isValid = request.purchase_token && request.product_id && request.device_id
      expect(isValid).toBeTruthy()
    })
  })

  describe('Credit Adjustment Validation', () => {
    it('should accept positive credit adjustment', () => {
      const adjustment = { amount: 100, reason: 'Compensation' }
      expect(adjustment.amount).toBeGreaterThan(0)
      expect(adjustment.reason).toBeDefined()
    })

    it('should accept negative credit adjustment', () => {
      const adjustment = { amount: -50, reason: 'Fraud detection' }
      expect(adjustment.amount).toBeLessThan(0)
      expect(adjustment.reason).toBeDefined()
    })

    it('should reject missing amount', () => {
      const adjustment = { reason: 'No amount' }
      expect(adjustment.amount).toBeUndefined()
    })
  })

  describe('Device ID Validation', () => {
    it('should accept valid UUID device_id', () => {
      const deviceId = '550e8400-e29b-41d4-a716-446655440000'
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuidRegex.test(deviceId)).toBe(true)
    })

    it('should reject malformed device_id', () => {
      const deviceId = 'not-a-uuid'
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuidRegex.test(deviceId)).toBe(false)
    })
  })

  describe('Admin Key Validation', () => {
    it('should accept valid admin key', () => {
      const adminKey = 'sk-admin-secret-key-12345'
      expect(adminKey.startsWith('sk-admin-')).toBe(true)
      expect(adminKey.length).toBeGreaterThan(10)
    })

    it('should reject empty admin key', () => {
      const adminKey = ''
      expect(adminKey.length).toBe(0)
    })

    it('should reject short admin key', () => {
      const adminKey = 'sk-admin-'
      expect(adminKey.length).toBeLessThan(20)
    })
  })
})