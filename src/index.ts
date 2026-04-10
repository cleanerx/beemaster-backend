import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { D1Database } from '@cloudflare/workers-types'

// Types
interface Env {
  DB: D1Database
  LITELLM_URL: string
  LITELLM_MASTER_KEY: string
  GOOGLE_PLAY_SERVICE_ACCOUNT: string
}

interface User {
  id: string
  user_id: string
  virtual_key: string
  credits_balance: number
  total_purchased: number
  created_at: string
}

interface PurchaseRequest {
  purchase_token: string
  product_id: string
  user_id: string
}

interface RegisterRequest {
  user_id: string
  device_id?: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for Android App
app.use('/*', cors({
  origin: ['*'],// TODO: Restrict to app package in production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health Check
app.get('/', (c) => {
  return c.json({
    service: 'beemaster-backend',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

// User Registration
app.post('/api/v1/user/register', async (c) => {
  const { user_id, device_id } = await c.req.json<RegisterRequest>()
  const db = c.env.DB

  if (!user_id) {
    return c.json({ error: 'user_id required' }, 400)
  }

  // Check if user exists
  const existing = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  if (existing) {
    return c.json({
      user_id: existing.user_id,
      virtual_key: existing.virtual_key,
      credits_balance: existing.credits_balance,
      total_purchased: existing.total_purchased
    })
  }

  // Generate Virtual Key
  const virtualKey = `sk-beemaster-${generateUUID()}`
  const id = generateUUID()

  // Create user in D1
  await db.prepare(`
    INSERT INTO users (id, user_id, virtual_key, credits_balance, total_purchased, created_at)
    VALUES (?, ?, ?, 100, 0, datetime('now'))
  `).bind(id, user_id, virtualKey).run()

  // Log welcome bonus
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, 100, 'BONUS', 'Welcome bonus', datetime('now'))
  `).bind(generateUUID(), user_id).run()

  // Create LiteLLM Virtual Key
  try {
    await fetch(`${c.env.LITELLM_URL}/user/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: user_id,
        max_budget: 10.00,
        models: ['nemotron']
      })
    })
  } catch (err) {
    // Non-critical error - user still gets local credits
    console.error('LiteLLM user creation failed:', err)
  }

  return c.json({
    user_id,
    virtual_key: virtualKey,
    credits_balance: 100,
    total_purchased: 0
  })
})

// Purchase Verification
app.post('/api/v1/purchase/verify', async (c) => {
  const { purchase_token, product_id, user_id } = await c.req.json<PurchaseRequest>()
  const db = c.env.DB

  // Credit mapping for products
  const creditMapping: Record<string, number> = {
    'credits_starter_100': 100,
    'credits_medium_500': 500,
    'credits_pro_2000': 2000,
    'credits_unlimited': 10000,
  }

  const credits = creditMapping[product_id] || 0

  if (credits === 0) {
    return c.json({ error: 'Unknown product' }, 400)
  }

  // Check for duplicate purchase
  const existing = await db.prepare(
    'SELECT * FROM purchases WHERE purchase_token = ?'
  ).bind(purchase_token).first()

  if (existing) {
    return c.json({ error: 'Purchase already verified' }, 400)
  }

  // Verify with Google Play API (placeholder - requires service account)
  // In production: call verifyGooglePlayPurchase()
  const isVerified = true// TODO: Implement actual verification

  if (!isVerified) {
    return c.json({ error: 'Invalid purchase' }, 400)
  }

  // Update user credits
  await db.prepare(`
    UPDATE users 
    SET credits_balance = credits_balance + ?,
        total_purchased = total_purchased + ?
    WHERE user_id = ?
  `).bind(credits, credits, user_id).run()

  // Get updated balance
  const user = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  // Log purchase
  await db.prepare(`
    INSERT INTO purchases (id, user_id, product_id, credits_added, purchase_token, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'VERIFIED', datetime('now'))
  `).bind(generateUUID(), user_id, product_id, credits, purchase_token).run()

  // Log transaction
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'PURCHASE', ?, datetime('now'))
  `).bind(generateUUID(), user_id, credits, `Purchased ${product_id}`).run()

  // Update LiteLLM budget
  try {
    await fetch(`${c.env.LITELLM_URL}/user/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: user_id,
        max_budget: (user?.credits_balance || 0) * 0.01// $0.01 per credit
      })
    })
  } catch (err) {
    console.error('LiteLLM update failed:', err)
  }

  return c.json({
    success: true,
    credits_added: credits,
    new_balance: user?.credits_balance || 0
  })
})

// Get Balance
app.get('/api/v1/user/balance', async (c) => {
  const user_id = c.req.query('user_id')
  const db = c.env.DB

  if (!user_id) {
    return c.json({ error: 'user_id required' }, 400)
  }

  const user = await db.prepare(
    'SELECT credits_balance, total_purchased FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    user_id,
    credits_balance: user.credits_balance,
    total_purchased: user.total_purchased
  })
})

// Credit Consumption (called by LiteLLM callback or directly)
app.post('/api/v1/credits/consume', async (c) => {
  const { user_id, amount, description } = await c.req.json()
  const db = c.env.DB

  // Check balance
  const user = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  if (user.credits_balance < amount) {
    return c.json({ error: 'Insufficient credits' }, 400)
  }

  // Deduct credits
  await db.prepare(`
    UPDATE users SET credits_balance = credits_balance - ? WHERE user_id = ?
  `).bind(amount, user_id).run()

  // Log transaction
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, -, 'USE', ?, datetime('now'))
  `).bind(generateUUID(), user_id, amount, description || 'LLM Query').run()

  // Get new balance
  const updated = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  return c.json({
    success: true,
    credits_consumed: amount,
    remaining_balance: updated?.credits_balance || 0
  })
})

// Helper Functions
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export default app