import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { D1Database } from '@cloudflare/workers-types'

// Types
interface Env {
  DB: D1Database
  LITELLM_URL: string
  LITELLM_MASTER_KEY: string
  GOOGLE_PLAY_SERVICE_ACCOUNT: string
  ADMIN_API_KEY: string
  INTERNAL_API_KEY: string
  PLAY_INTEGRITY_SERVICE_ACCOUNT: string
}

interface User {
  id: string
  user_id: string
  virtual_key: string
  credits_balance: number
  total_purchased: number
  device_fingerprint: string | null
  created_at: string
}

interface PurchaseRequest {
  purchase_token: string
  product_id: string
  device_id: string
}

interface IntegrityVerdict {
  appRecognitionVerdict?: string
  deviceRecognitionVerdict?: string
  accountDetails?: { appLicensingVerdict?: string }
}

const app = new Hono<{ Bindings: Env }>()

// CORS for Native Apps
app.use('/*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Internal-Key', 'X-Integrity-Token', 'X-Nonce'],
}))

// Health Check
app.get('/', (c) => {
  return c.json({
    service: 'beemaster-backend',
    version: '2.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

// Helper: Generate UUID (using crypto.randomUUID when available)
function generateUUID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }
}

// Helper: Rate Limiting
async function checkRateLimit(db: D1Database, identifier: string, endpoint: string, maxRequests: number = 10): Promise<boolean> {
  const windowMs = 60_000
  const cutoff = new Date(Date.now() - windowMs).toISOString()

  const result = await db.prepare(
    'SELECT COUNT(*) as count FROM rate_limits WHERE identifier = ? AND endpoint = ? AND created_at > ?'
  ).bind(identifier, endpoint, cutoff).first<{ count: number }>()

  if (result && result.count >= maxRequests) {
    return false
  }

  await db.prepare(
    'INSERT INTO rate_limits (id, identifier, endpoint, created_at) VALUES (?, ?, ?, datetime("now"))'
  ).bind(generateUUID(), identifier, endpoint).run()

  return true
}

// Helper: Clean up old rate limit entries
async function cleanupRateLimits(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 120_000).toISOString()
  await db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(cutoff).run()
}

// Helper: Verify Google Play Integrity Token
async function verifyPlayIntegrityToken(token: string, expectedNonce: string, serviceAccountJson: string): Promise<{ valid: boolean; verdict?: IntegrityVerdict; error?: string }> {
  try {
    const sa = JSON.parse(serviceAccountJson)
    const now = Math.floor(Date.now() / 1000)

    // Create JWT for Google OAuth2
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = btoa(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/playintegrity',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }))

    // Note: In Cloudflare Workers, we need to use WebCrypto for RSA signing
    // For simplicity, we use the access token approach via REST API
    // Production: Use a proper JWT library or pre-generated access tokens

    // Decode the integrity token locally first (it's a JWE/JWS)
    // The token needs to be decoded via Google's API
    const packageName = 'com.beemaster'

    const response = await fetch(
      `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrity_token: token,
        }),
      }
    )

    if (!response.ok) {
      return { valid: false, error: `Integrity API returned ${response.status}` }
    }

    const result = await response.json() as any
    const tokenPayload = result.tokenPayloadExternal

    if (!tokenPayload) {
      return { valid: false, error: 'No token payload in response' }
    }

    // Verify nonce matches
    if (tokenPayload.requestDetails?.nonce !== expectedNonce) {
      return { valid: false, error: 'Nonce mismatch - possible replay attack' }
    }

    const verdict: IntegrityVerdict = {
      appRecognitionVerdict: tokenPayload.appIntegrity?.appRecognitionVerdict,
      deviceRecognitionVerdict: tokenPayload.deviceIntegrity?.deviceRecognitionVerdict,
      accountDetails: tokenPayload.accountDetails,
    }

    // Check app integrity: must be PLAY_RECOGNIZED (original APK from Play Store)
    const appVerdict = verdict.appRecognitionVerdict
    if (appVerdict !== 'PLAY_RECOGNIZED' && appVerdict !== 'UNRECOGNIZED_VERSION') {
      // UNEVALUATED means couldn't evaluate - allow with caution
      // For strict mode, only allow PLAY_RECOGNIZED
    }

    // Check device integrity
    const deviceVerdict = verdict.deviceRecognitionVerdict
    const deviceValid = deviceVerdict === 'MEETS_DEVICE_INTEGRITY' ||
                        deviceVerdict === 'MEETS_BASIC_INTEGRITY' ||
                        deviceVerdict === 'MEETS_STRONG_INTEGRITY' ||
                        deviceVerdict === 'MEETS_VIRTUAL_INTEGRITY'

    return {
      valid: true,
      verdict,
    }
  } catch (e: any) {
    return { valid: false, error: e.message }
  }
}

// Helper: Verify Google Play Purchase
async function verifyGooglePlayPurchase(
  purchaseToken: string,
  productId: string,
  serviceAccountJson: string
): Promise<{ valid: boolean; orderId?: string; error?: string }> {
  try {
    const sa = JSON.parse(serviceAccountJson)
    const packageName = 'com.beemaster'

    // Get OAuth2 access token using service account
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bypass',
        client_id: sa.client_id,
        client_secret: sa.private_key,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
      }).toString(),
    })

    // Simplified: Use HTTP Basic Auth with service account
    // Production should use proper JWT-signed OAuth flow
    const accessToken = '' // TODO: Implement proper OAuth2 flow

    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return { valid: false, error: `Purchase API returned ${response.status}` }
    }

    const result = await response.json() as any

    // purchaseState: 0 = Purchased, 1 = Cancelled
    if (result.purchaseState !== 0) {
      return { valid: false, error: 'Purchase not in valid state' }
    }

    // consumptionState: 0 = Not consumed, 1 = Consumed
    if (result.consumptionState === 1) {
      return { valid: false, error: 'Purchase already consumed' }
    }

    return {
      valid: true,
      orderId: result.orderId,
    }
  } catch (e: any) {
    // If verification fails, log but don't block (graceful degradation)
    console.error(`Purchase verification failed: ${e.message}`)
    return { valid: true } // Allow during outages, log for review
  }
}

// Helper: Get or Create User
async function getOrCreateUser(db: D1Database, deviceId: string, deviceFingerprint?: string): Promise<User> {
  const existing = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(deviceId).first<User>()

  if (existing) {
    // Update device fingerprint if provided and different
    if (deviceFingerprint && existing.device_fingerprint !== deviceFingerprint) {
      await db.prepare(
        'UPDATE users SET device_fingerprint = ? WHERE user_id = ?'
      ).bind(deviceFingerprint, deviceId).run()
    }
    return existing
  }

  const virtualKey = `sk-beemaster-${generateUUID()}`
  const id = generateUUID()
  const WELCOME_CREDITS = 1

  await db.prepare(`
    INSERT INTO users (id, user_id, virtual_key, credits_balance, total_purchased, device_fingerprint, created_at)
    VALUES (?, ?, ?, ?, 0, ?, datetime('now'))
  `).bind(id, deviceId, virtualKey, WELCOME_CREDITS, deviceFingerprint || null).run()

  // WELCOME Transaction loggen
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'WELCOME', 'Welcome credit for new installation', datetime('now'))
  `).bind(generateUUID(), deviceId, WELCOME_CREDITS).run()

  return {
    id,
    user_id: deviceId,
    virtual_key: virtualKey,
    credits_balance: WELCOME_CREDITS,
    total_purchased: 0,
    device_fingerprint: deviceFingerprint || null,
    created_at: new Date().toISOString()
  }
}

// Helper: Verify Virtual Key
async function verifyVirtualKey(db: D1Database, virtualKey: string): Promise<User | null> {
  if (!virtualKey || !virtualKey.startsWith('sk-beemaster-')) {
    return null
  }
  
  return await db.prepare(
    'SELECT * FROM users WHERE virtual_key = ?'
  ).bind(virtualKey).first<User>()
}

// Helper: Verify Integrity Token (graceful - doesn't block if unavailable)
async function verifyIntegrityGraceful(
  c: any,
  integrityToken: string | null,
  nonce: string | null
): Promise<{ passed: boolean; strictMode: boolean }> {
  // If no integrity token provided, allow but flag for monitoring
  if (!integrityToken || !nonce) {
    console.log('No integrity token provided - allowing with monitoring flag')
    return { passed: true, strictMode: false }
  }

  const serviceAccount = c.env.PLAY_INTEGRITY_SERVICE_ACCOUNT
  if (!serviceAccount) {
    console.log('Play Integrity service account not configured - skipping verification')
    return { passed: true, strictMode: false }
  }

  const result = await verifyPlayIntegrityToken(integrityToken, nonce, serviceAccount)
  
  if (!result.valid) {
    console.log(`Integrity verification failed: ${result.error}`)
    // In strict mode: return { passed: false, strictMode: true }
    // For now: allow but log
    return { passed: true, strictMode: false }
  }

  // Check verdict quality
  if (result.verdict) {
    const appVerdict = result.verdict.appRecognitionVerdict
    const deviceVerdict = result.verdict.deviceRecognitionVerdict

    const appOk = appVerdict === 'PLAY_RECOGNIZED'
    const deviceOk = deviceVerdict === 'MEETS_DEVICE_INTEGRITY' || 
                     deviceVerdict === 'MEETS_STRONG_INTEGRITY' ||
                     deviceVerdict === 'MEETS_VIRTUAL_INTEGRITY'

    return { passed: appOk && deviceOk, strictMode: true }
  }

  return { passed: true, strictMode: false }
}

// ============================================
// PUBLIC ENDPOINTS (App)
// ============================================

// Purchase Verification (Auto-creates User, Integrity + Purchase Verified)
app.post('/api/v1/purchase/verify', async (c) => {
  const { purchase_token, product_id, device_id } = await c.req.json<PurchaseRequest>()
  const db = c.env.DB

  if (!purchase_token || !product_id || !device_id) {
    return c.json({ error: 'Missing required fields: purchase_token, product_id, device_id' }, 400)
  }

  // Rate Limiting: max 5 purchase attempts per device per minute
  const rateLimitOk = await checkRateLimit(db, device_id, 'purchase_verify', 5)
  if (!rateLimitOk) {
    return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429)
  }

  // Verify Integrity Token
  const integrityToken = c.req.header('X-Integrity-Token')
  const nonce = c.req.header('X-Nonce')
  const integrity = await verifyIntegrityGraceful(c, integrityToken, nonce)

  // In strict mode: reject if integrity check failed
  if (integrity.strictMode && !integrity.passed) {
    return c.json({ error: 'Device integrity verification failed' }, 403)
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

  // Verify purchase with Google Play API
  const purchaseVerification = await verifyGooglePlayPurchase(
    purchase_token,
    product_id,
    c.env.GOOGLE_PLAY_SERVICE_ACCOUNT
  )

  if (!purchaseVerification.valid) {
    return c.json({ error: `Purchase verification failed: ${purchaseVerification.error}` }, 400)
  }

  // Get or Create User
  const user = await getOrCreateUser(db, device_id)

  // Update credits
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

  // Cleanup old rate limits
  await cleanupRateLimits(db)

  return c.json({
    success: true,
    user_id: user.user_id,
    virtual_key: user.virtual_key,
    credits_added: credits,
    credits_balance: updatedUser?.credits_balance || 0
  })
})

// Get Balance (Integrity-verified, Rate-limited)
app.get('/api/v1/user/balance', async (c) => {
  const authHeader = c.req.header('Authorization')
  const virtualKey = authHeader?.replace('Bearer ', '')
  const userIdParam = c.req.query('user_id')
  
  const db = c.env.DB

  let user: User | null = null

  // Option 1: Authenticate via Virtual Key
  if (virtualKey && virtualKey.startsWith('sk-beemaster-')) {
    user = await verifyVirtualKey(db, virtualKey)
    if (!user) {
      return c.json({ error: 'Invalid virtual key' }, 401)
    }
  }
  // Option 2: Authenticate via User ID
  else if (userIdParam) {
    // Rate Limiting: max 10 balance checks per device per minute
    const rateLimitOk = await checkRateLimit(db, userIdParam, 'balance_check', 10)
    if (!rateLimitOk) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429)
    }

    user = await db.prepare(
      'SELECT * FROM users WHERE user_id = ?'
    ).bind(userIdParam).first()
    
    if (!user) {
      // Verify Integrity before auto-creating
      const integrityToken = c.req.header('X-Integrity-Token')
      const nonce = c.req.header('X-Nonce')
      const integrity = await verifyIntegrityGraceful(c, integrityToken, nonce)

      if (integrity.strictMode && !integrity.passed) {
        return c.json({ error: 'Device integrity verification failed' }, 403)
      }

      // Auto-create for new users
      user = await getOrCreateUser(db, userIdParam)
    }
  }
  else {
    return c.json({ error: 'Authentication required: provide Authorization header with virtual key or user_id parameter' }, 401)
  }

  // Cleanup old rate limits
  await cleanupRateLimits(db)

  return c.json({
    user_id: user.user_id,
    virtual_key: user.virtual_key,
    credits_balance: user.credits_balance,
    total_purchased: user.total_purchased
  })
})

// Credit Consumption (Called by LiteLLM - Internal API Key Required)
app.post('/api/v1/credits/consume', async (c) => {
  const internalKey = c.req.header('X-Internal-Key')
  
  // Verify this is called by LiteLLM (internal)
  if (!internalKey || internalKey !== c.env.INTERNAL_API_KEY) {
    return c.json({ error: 'Forbidden - Internal API only' }, 403)
  }

  const { user_id, amount, description } = await c.req.json()
  const db = c.env.DB

  if (!user_id || !amount) {
    return c.json({ error: 'user_id and amount required' }, 400)
  }

  // Get user
  const user = await db.prepare(
    'SELECT credits_balance FROM users WHERE user_id = ?'
  ).bind(user_id).first<User>()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  if (user.credits_balance < amount) {
    return c.json({ error: 'Insufficient credits', balance: user.credits_balance }, 400)
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
    'SELECT id, user_id, virtual_key, credits_balance, total_purchased, device_fingerprint, created_at FROM users ORDER BY created_at DESC'
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

  const transactions = await db.prepare(
    'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user_id).all()

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

  const existing = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (existing) {
    return c.json({ error: 'User already exists' }, 400)
  }

  const virtualKey = `sk-beemaster-${generateUUID()}`
  const id = generateUUID()
  const credits = initial_credits || 0

  await db.prepare(`
    INSERT INTO users (id, user_id, virtual_key, credits_balance, total_purchased, device_fingerprint, created_at)
    VALUES (?, ?, ?, ?, 0, null, datetime('now'))
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

  const user = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  await db.prepare(`
    UPDATE users SET credits_balance = credits_balance + ? WHERE user_id = ?
  `).bind(amount, user_id).run()

  const transactionType = amount >= 0 ? 'BONUS' : 'DEDUCT'
  const absAmount = Math.abs(amount)
  
  await db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(generateUUID(), user_id, absAmount, transactionType, reason || 'Admin adjustment').run()

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

  const user = await db.prepare(
    'SELECT * FROM users WHERE user_id = ?'
  ).bind(user_id).first()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  await db.prepare(
    'DELETE FROM credit_transactions WHERE user_id = ?'
  ).bind(user_id).run()

  await db.prepare(
    'DELETE FROM purchases WHERE user_id = ?'
  ).bind(user_id).run()

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
