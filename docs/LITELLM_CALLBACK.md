# LiteLLM Callback for Beemaster Credits

This document explains how LiteLLM calls back to the Beemaster backend to deduct credits.

## Flow

```
1. User sends LLM request to LiteLLM
   └─ Header: Authorization: Bearer sk-beemaster-xxx
   
2. LiteLLM validates Virtual Key
   └─ Checks: Virtual Key exists in database
   └─ Checks: User has sufficient budget

3. LiteLLM routes request to DeepInfra
   └─ Model: Nemotron-3-Nano-30B
   └─ Returns response

4. LiteLLM calculates cost
   └─ Input tokens: X
   └─ Output tokens: Y
   └─ Cost: $0.000XXX

5. LiteLLM callback to Beemaster Backend
   └─ POST /api/v1/credits/consume
   └─ Header: X-Internal-Key: {INTERNAL_API_KEY}
   └─ Body: { user_id, amount, description }
   
6. Beemaster Backend deducts credits
   └─ Validates INTERNAL_API_KEY
   └─ Deducts credits from user
   └─ Logs transaction
```

## Configuration

### Environment Variables

```bash
# In Railway/Fly.io
BEEMASTER_BACKEND_URL=https://beemaster-backend.cleanerx.workers.dev
INTERNAL_API_KEY=your-internal-secret-key
DEEPINFRA_API_KEY=your-deepinfra-key
LITELLM_MASTER_KEY=your-master-key
```

### Setup in LiteLLM

```python
# custom_callback.py
import os
import requests

BEEMASTER_BACKEND_URL = os.getenv("BEEMASTER_BACKEND_URL")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

def beemaster_credits_callback(kwargs):
    """Called after each successful LLM request."""
    
    # Get user from Virtual Key
    user_id = kwargs.get("user", "unknown")
    
    # Calculate credits (1 credit per 1000 tokens)
    usage = kwargs.get("usage", {})
    total_tokens = usage.get("total_tokens", 0)
    credits = max(1, total_tokens // 1000)
    
    # Callback to Beemaster Backend
    response = requests.post(
        f"{BEEMASTER_BACKEND_URL}/api/v1/credits/consume",
        headers={
            "X-Internal-Key": INTERNAL_API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "user_id": user_id,
            "amount": credits,
            "description": f"LLM Query ({total_tokens} tokens)"
        }
    )
    
    return response.json()
```

## Credit Calculation

| Tokens | Credits |
|--------|---------|
| 1-999 | 1 |
| 1000-1999 | 1 |
| 2000-2999 | 2 |
| 3000-3999 | 3 |
| ... | ... |

Formula: `credits = max(1, total_tokens // 1000)`

## Security

1. **Virtual Key**: User-specific, passed in Authorization header
2. **Internal Key**: Only known by LiteLLM and Beemaster Backend
3. **HTTPS**: All communication encrypted
4. **No User API Key Stored**: DeepInfra key is server-side only

---

*Created: 2026-04-10*