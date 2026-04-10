import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { D1Database } from '@cloudflare/workers-types'

// Types
interface Env {
  DB: D1Database
  LITELLM_URL: string
  LITELLM_MASTER_KEY: string
  GOOGLE_PLAY_SERVICE_ACCOUNT: string
  ADMIN_API_KEY: string
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
  device_id: string
}

interface AdminAuthRequest {
  admin_key: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for Native Apps (not browser-restricted)
app.use('/*', cors({
  origin: ['*'],// Native Apps don't check CORS
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
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

// Helper: Generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// Helper: Get or Create User
async function getOrCreateUser(db: D1Database, deviceId: string): Promise<User> {
  // Check if user exists
  const existing = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(deviceId).first<User>()

  if (existing) {
    return existing
  }

  // Create new user
  const virtualKey = `sk-beemaster-${generateUUID()}`
  const id = generateUUID()

  await db.prepare(`
    INSERT INTO users (id, user_id, virtual_key, credits_balance, total_purchased, created_at)
    VALUES (?, ?, ?, 0, 0, datetime('now'))
  `).bind(id, deviceId, virtualKey).run()

  return {
    id,
    user_id: deviceId,
    virtual_key: virtualKey,
    credits_balance: 0,
    total_purchased: 0,
    created_at: new Date().toISOString()
  }
}

// ============================================
// PUBLIC ENDPOINTS (App)
// ============================================

// Purchase Verification (Auto-creates User)
app.post('/api/v1/purchase/verify', async (c) => {
  const { purchase_token, product_id, device_id } = await c.req.json<PurchaseRequest>()
  const db = c.env.DB

  if (!purchase_token || !product_id || !device_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

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

  // Get or Create User (Auto-creation)
  const user = await getOrCreateUser(db, device_id)

  // TODO: Verify with Google Play API (requires service account)
  // const isValid = await verifyGooglePlayPurchase(purchase_token, product_id)
  const isValid = true // Placeholder for now

  if (!isValid) {
    return c.json({ error: 'Invalid purchase' }, 400)
  }

  // Update user credits
  await db.prepare(`
    UPDATE users 
    SET credits_balance = credits_balance + ?,
        total_purchased = total_purchased + ?
    WHERE user_id = ?
  `).bind(credits, credits, user.user_id).run()

  // Get updated balance
  const updatedUser = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user.user_id).first<User>()

  // Log purchase
  await db.prepare(`
    INSERT INTO purchases (id, user_id, product_id, credits_added, purchase_token, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'VERIFIED', datetime('now'))
  `).bind(generateUUID(), user.user_id, product_id, credits, purchase_token).run()

  // Log transaction
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'PURCHASE', ?, datetime('now'))
  `).bind(generateUUID(), user.user_id, credits, `Purchased ${product_id}`).run()

  // Update LiteLLM budget (if configured)
  if (c.env.LITELLM_URL && c.env.LITELLM_MASTER_KEY) {
    try {
      await fetch(`${c.env.LITELLM_URL}/user/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.user_id,
          max_budget: (updatedUser?.credits_balance || 0) * 0.01// $0.01 per credit
        })
      })
    } catch (err) {
      console.error('LiteLLM update failed:', err)
    }
  }

  return c.json({
    success: true,
    user_id: user.user_id,
    virtual_key: user.virtual_key,
    credits_added: credits,
    credits_balance: updatedUser?.credits_balance || 0
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
    'SELECT user_id, virtual_key, credits_balance, total_purchased FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    // Auto-create user if not exists (for free tier lookup)
    const newUser = await getOrCreateUser(db, user_id)
    return c.json({
      user_id: newUser.user_id,
      virtual_key: newUser.virtual_key,
      credits_balance: newUser.credits_balance,
      total_purchased: newUser.total_purchased
    })
  }

  return c.json(user)
})

// Credit Consumption (called by LiteLLM or App)
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
    VALUES (?, ?, ?, 'USE', ?, datetime('now'))
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

// ============================================
// ADMIN ENDPOINTS (Protected)
// ============================================

// Admin Auth Middleware
async function verifyAdmin(c: any, next: any) {
  const adminKey = c.req.header('X-Admin-Key')
  
  if (!adminKey || adminKey !== c.env.ADMIN_API_KEY) {
    return c.json({ error: 'Unauthorized - Admin access required' }, 401)
  }
  
  await next()
}

// List all Users (Admin)
app.get('/api/v1/admin/users', verifyAdmin, async (c) => {
  const db = c.env.DB
  
  const users = await db.prepare(
    'SELECT id, user_id, virtual_key, credits_balance, total_purchased, created_at FROM users ORDER BY created_at DESC'
  ).all()

  return c.json({
    count: users.results?.length || 0,
    users: users.results
  })
})

// Get User Details (Admin)
app.get('/api/v1/admin/users/:user_id', verifyAdmin, async (c) => {
  const user_id = c.req.param('user_id')
  const db = c.env.DB

  const user = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Get transactions
  const transactions = await db.prepare(
    'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user_id).all()

  // Get purchases
  const purchases = await db.prepare(
    'SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user_id).all()

  return c.json({
    user,
    transactions: transactions.results,
    purchases: purchases.results
  })
})

// Create User (Admin)
app.post('/api/v1/admin/users', verifyAdmin, async (c) => {
  const { user_id, initial_credits } = await c.req.json()
  const db = c.env.DB

  if (!user_id) {
    return c.json({ error: 'user_id required' }, 400)
  }

  // Check if user exists
  const existing = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (existing) {
    return c.json({ error: 'User already exists' }, 400)
  }

  // Create user
  const virtualKey = `sk-beemaster-${generateUUID()}`
  const id = generateUUID()
  const credits = initial_credits || 0

  await db.prepare(`
    INSERT INTO users (id, user_id, virtual_key, credits_balance, total_purchased, created_at)
    VALUES (?, ?, ?, ?, 0, datetime('now'))
  `).bind(id, user_id, virtualKey, credits).run()

  if (credits > 0) {
    await db.prepare(`
      INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'BONUS', 'Admin granted credits', datetime('now'))
    `).bind(generateUUID(), user_id, credits).run()
  }

  return c.json({
    success: true,
    user_id,
    virtual_key: virtualKey,
    credits_balance: credits
  })
})

// Update User Credits (Admin)
app.put('/api/v1/admin/users/:user_id/credits', verifyAdmin, async (c) => {
  const user_id = c.req.param('user_id')
  const { amount, reason } = await c.req.json()
  const db = c.env.DB

  if (amount === undefined || amount === null) {
    return c.json({ error: 'amount required' }, 400)
  }

  // Check if user exists
  const user = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Update credits
  await db.prepare(`
    UPDATE users SET credits_balance = credits_balance + ? WHERE user_id = ?
  `).bind(amount, user_id).run()

  // Log transaction
  const transactionType = amount >= 0 ? 'BONUS' : 'DEDUCT'
  const absAmount = Math.abs(amount)
  
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(generateUUID(), user_id, absAmount, transactionType, reason || 'Admin adjustment').run()

  // Get updated balance
  const updated = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  return c.json({
    success: true,
    user_id,
    credits_changed: amount,
    credits_balance: updated?.credits_balance || 0
  })
})

// Delete User (Admin)
app.delete('/api/v1/admin/users/:user_id', verifyAdmin, async (c) => {
  const user_id = c.req.param('user_id')
  const db = c.env.DB

  // Check if user exists
  const user = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Delete transactions
  await db.prepare(
    'DELETE FROM credit_transactions WHERE user_id = ?'
  ).bind(user_id).run()

  // Delete purchases
  await db.prepare(
    'DELETE FROM purchases WHERE user_id = ?'
  ).bind(user_id).run()

  // Delete user
  await db.prepare(
    'DELETE FROM users WHERE user_id = ?'
  ).bind(user_id).run()

  return c.json({
    success: true,
    message: `User ${user_id} deleted`
  })
})

// Get System Stats (Admin)
app.get('/api/v1/admin/stats', verifyAdmin, async (c) => {
  const db = c.env.DB

  const totalUsers = await db.prepare(
    'SELECT COUNT(*) as count FROM users'
  ).first()

  const totalCredits = await db.prepare(
    'SELECT SUM(credits_balance) as total FROM users'
  ).first()

  const totalPurchases = await db.prepare(
    'SELECT COUNT(*) as count FROM purchases'
  ).first()

  const totalTransactions = await db.prepare(
    'SELECT COUNT(*) as count FROM credit_transactions'
  ).first()

  return c.json({
    total_users: totalUsers?.count || 0,
    total_credits_in_circulation: totalCredits?.total || 0,
    total_purchases: totalPurchases?.count || 0,
    total_transactions: totalTransactions?.count || 0
  })
})

export default app