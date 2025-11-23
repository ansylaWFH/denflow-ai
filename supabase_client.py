import os
from supabase import create_client, Client

url: str = os.environ.get("SUPABASE_URL", "https://kwnmbvqaxtoyffzpecfw.supabase.co")
key: str = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bm1idnFheHRveWZmenBlY2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTUyMzYsImV4cCI6MjA3OTM3MTIzNn0.IkVNifA5a0BzqEokt9dnQxKs1E6iT43AiodvBoQuMAs")

supabase: Client = create_client(url, key)

def verify_token(token: str):
    try:
        user = supabase.auth.get_user(token)
        return user
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None
