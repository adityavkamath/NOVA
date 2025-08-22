from fastapi import Header, HTTPException
import requests
import jwt
from supabase_client import supabase
import uuid
import os
from config import DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS

async def get_current_user(authorization: str = Header(None), user_id: str = Header(None, alias="user-id")):
    try:
        # Try JWT authentication first
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            
            # Get Clerk JWKS URL to verify the token
            clerk_jwks_url = os.getenv("CLERK_JWKS_URL")
            clerk_issuer = os.getenv("CLERK_ISSUER")
            
            if not clerk_jwks_url or not clerk_issuer:
                raise HTTPException(status_code=500, detail="Clerk configuration missing")

            # Get JWKS from Clerk
            jwks_response = requests.get(clerk_jwks_url, timeout=10)
            if jwks_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to fetch JWKS")
            
            jwks = jwks_response.json()
            
            # Decode JWT header to get key ID
            unverified_header = jwt.get_unverified_header(token)
            key_id = unverified_header.get("kid")
            
            # Find the right key
            public_key = None
            for key in jwks.get("keys", []):
                if key.get("kid") == key_id:
                    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
            
            if not public_key:
                raise HTTPException(status_code=401, detail="Public key not found")
            
            # Verify and decode the token
            decoded_token = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                issuer=clerk_issuer,
                options={"verify_aud": False}  # Clerk doesn't always include aud
            )
            
            clerk_user_id = decoded_token.get("sub")
            email = decoded_token.get("email")
            
            if not clerk_user_id:
                raise HTTPException(status_code=401, detail="Invalid token: missing user ID")

        # Fallback to legacy user-id header authentication
        elif user_id:
            clerk_user_id = user_id
            email = None
            
        else:
            raise HTTPException(status_code=401, detail="Authorization header or user-id header required")

        # Check if user exists in Supabase, create if not
        existing_user = supabase.table("users").select("*").eq("clerk_user_id", clerk_user_id).execute()

        if existing_user.data:
            return existing_user.data[0]

        # Create new user if doesn't exist
        if not email:
            # For legacy authentication, try to get user info from Clerk API
            try:
                clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
                if clerk_secret_key:
                    headers = {
                        "Authorization": f"Bearer {clerk_secret_key}",
                        "Content-Type": "application/json"
                    }
                    response = requests.get(
                        f"https://api.clerk.com/v1/users/{clerk_user_id}",
                        headers=headers,
                        timeout=10
                    )
                    if response.status_code == 200:
                        clerk_user = response.json()
                        email_addresses = clerk_user.get("email_addresses", [])
                        if email_addresses:
                            for e in email_addresses:
                                if isinstance(e, dict) and e.get("id") == clerk_user.get("primary_email_address_id"):
                                    email = e.get("email_address")
                                    break
                            if not email and len(email_addresses) > 0:
                                first_email = email_addresses[0]
                                if isinstance(first_email, dict):
                                    email = first_email.get("email_address")
            except Exception as e:
                print(f"Warning: Could not fetch user details from Clerk API: {e}")
        
        # Use email or create a fallback
        if not email:
            email = f"user_{clerk_user_id}@clerk.local"
        
        name = f"User {clerk_user_id}"  # Default name
        
        new_user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "clerk_user_id": clerk_user_id,
            "llm_model": DEFAULT_MODEL,
            "temperature": DEFAULT_TEMPERATURE,
            "max_tokens": DEFAULT_MAX_TOKENS,
        }

        result = supabase.table("users").insert(new_user).execute()
        return result.data[0]

    except jwt.ExpiredSignatureError:
        print("Error in get_current_user: Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"Error in get_current_user: Invalid token - {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except requests.exceptions.RequestException as req_e:
        print(f"Error in get_current_user (Request Error): {str(req_e)}")
        raise HTTPException(status_code=401, detail="Failed to connect to authentication service")
    except Exception as e:
        print(f"Error in get_current_user (General Error): {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

  
