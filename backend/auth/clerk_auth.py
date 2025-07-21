from fastapi import Header, HTTPException
import requests
from supabase_client import supabase
import uuid
import os
from config import DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS

async def get_current_user(user_id: str = Header(...)):
    try:
        clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
        if not clerk_secret_key:
            raise HTTPException(status_code=500, detail="Clerk secret key not configured")

        headers = {
            "Authorization": f"Bearer {clerk_secret_key}",
            "Content-Type": "application/json"
        }

        response = requests.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers=headers
        )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch user from Clerk")

        clerk_user = response.json()

        # Handle email_addresses safely
        email_addresses = clerk_user.get("email_addresses", [])
        if not isinstance(email_addresses, list):
            email_addresses = []
        
        primary_email = None
        if email_addresses:
            # Try to get primary email
            for e in email_addresses:
                if isinstance(e, dict) and e.get("id") == clerk_user.get("primary_email_address_id"):
                    primary_email = e.get("email_address")
                    break
            
            # Fallback to first email if primary not found
            if not primary_email and len(email_addresses) > 0:
                first_email = email_addresses[0]
                if isinstance(first_email, dict):
                    primary_email = first_email.get("email_address")
                elif isinstance(first_email, str):
                    primary_email = first_email

        if not primary_email:
            raise HTTPException(status_code=401, detail="Primary email not found")

        name = f"{clerk_user.get('first_name', '')} {clerk_user.get('last_name', '')}".strip()

        # Check if the user already exists in Supabase
        existing_user = supabase.table("users").select("*").eq("email", primary_email).execute()

        if existing_user.data:
            return existing_user.data[0]

        # Create new Supabase user if there is no such user
        new_user = {
            "id": str(uuid.uuid4()),
            "email": primary_email,
            "name": name or primary_email.split('@')[0],
            "clerk_user_id": user_id,
            "llm_model": DEFAULT_MODEL,
            "temperature": DEFAULT_TEMPERATURE,
            "max_tokens": DEFAULT_MAX_TOKENS,
        }

        result = supabase.table("users").insert(new_user).execute()
        return result.data[0]

    except Exception as e:
        print(f"Error in get_current_user: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")
