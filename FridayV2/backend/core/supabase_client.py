from supabase import create_client, Client
from functools import lru_cache
from .config import settings


@lru_cache
def get_supabase() -> Client:
    return create_client(str(settings.SUPABASE_URL), settings.SUPABASE_KEY)


supabase = get_supabase()
