import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# Setup Supabase client just for auth verification if needed,
# or use the existing one from app.core.database
from app.core.database import supabase

logger = logging.getLogger(__name__)

security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    try:
        # Verify token with Supabase
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise ValueError("Invalid user")

        return User(
            id=user_res.user.id,
            email=user_res.user.email
        )
    except Exception as e:
        logger.warning(f"Auth failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
