"""
Supabase client configuration and helper functions.

This module provides integration with Supabase for:
- Authentication (optional, can use alongside FastAPI auth)
- Storage (file uploads, images, documents)
- Real-time subscriptions
- Additional Supabase features
"""

from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.core.config import settings


@lru_cache()
def get_supabase_client() -> Client | None:
    """
    Get Supabase client instance (cached).
    Returns None if Supabase is not configured.
    """
    if not settings.supabase_enabled:
        return None

    return create_client(
        supabase_url=settings.SUPABASE_URL,  # type: ignore
        supabase_key=settings.SUPABASE_KEY,  # type: ignore
    )


@lru_cache()
def get_supabase_admin_client() -> Client | None:
    """
    Get Supabase admin client with service role key (cached).
    Use this for admin operations that bypass Row Level Security (RLS).
    Returns None if Supabase is not configured.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None

    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_KEY,
    )


class SupabaseStorage:
    """Helper class for Supabase Storage operations."""

    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self.client = get_supabase_client()

    def upload_file(
        self, file_path: str, file_data: bytes, content_type: str | None = None
    ) -> dict[str, Any] | None:
        """Upload a file to Supabase Storage."""
        if not self.client:
            return None

        options = {"content-type": content_type} if content_type else {}
        return self.client.storage.from_(self.bucket_name).upload(
            file_path, file_data, file_options=options
        )

    def download_file(self, file_path: str) -> bytes | None:
        """Download a file from Supabase Storage."""
        if not self.client:
            return None

        return self.client.storage.from_(self.bucket_name).download(file_path)

    def get_public_url(self, file_path: str) -> str | None:
        """Get public URL for a file in Supabase Storage."""
        if not self.client:
            return None

        return self.client.storage.from_(self.bucket_name).get_public_url(file_path)

    def delete_file(self, file_path: str) -> dict[str, Any] | None:
        """Delete a file from Supabase Storage."""
        if not self.client:
            return None

        return self.client.storage.from_(self.bucket_name).remove([file_path])

    def list_files(self, folder_path: str = "") -> list[dict[str, Any]] | None:
        """List files in a folder in Supabase Storage."""
        if not self.client:
            return None

        return self.client.storage.from_(self.bucket_name).list(folder_path)


# Example usage:
# storage = SupabaseStorage("avatars")
# storage.upload_file("user-123/profile.jpg", image_bytes, "image/jpeg")
# url = storage.get_public_url("user-123/profile.jpg")

