"""
Beemaster Credit Deduction Callback for LiteLLM

This callback is triggered after each successful LLM request.
It deducts credits from the user's balance via the Beemaster Backend.

Environment Variables:
- BEEMASTER_BACKEND_URL: URL of the Beemaster Backend
- INTERNAL_API_KEY: Secret key for backend authentication
"""

import os
import requests
import logging

logger = logging.getLogger(__name__)

BEEMASTER_BACKEND_URL = os.getenv("BEEMASTER_BACKEND_URL", "https://beemaster-backend.cleanerx.workers.dev")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")


def beemaster_credits_callback(kwargs):
    """
    Called after each successful LLM request.
    
    Deducts credits from the user's balance based on token usage.
    Formula: credits = max(1, total_tokens // 1000)
    
    Args:
        kwargs: LiteLLM callback kwargs containing:
            - user: The user_id (from Virtual Key)
            - usage: Token usage dict with total_tokens
            - model: The model used
    
    Returns:
        dict: Response from Beemaster Backend
    """
    try:
        # Extract user_id from Virtual Key mapping
        user_id = kwargs.get("user", "unknown")
        
        # Get token usage
        usage = kwargs.get("usage", {})
        total_tokens = usage.get("total_tokens", 0)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        
        # Calculate credits (1 credit per1000 tokens, minimum 1)
        credits = max(1, total_tokens // 1000)
        
        # Build description
        model = kwargs.get("model", "unknown")
        description = f"LLM Query: {model} ({total_tokens} tokens: {prompt_tokens} prompt + {completion_tokens} completion)"
        
        logger.info(f"Deducting {credits} credits for user {user_id}")
        
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
                "description": description
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Credits deducted: {result}")
            return result
        else:
            logger.error(f"Failed to deduct credits: {response.status_code} - {response.text}")
            return {"error": response.text}
            
    except Exception as e:
        logger.error(f"Beemaster callback error: {str(e)}")
        return {"error": str(e)}


# LiteLLM callback registration
async def async_success_callback(kwargs):
    """Async wrapper for the success callback."""
    return beemaster_credits_callback(kwargs)