"""Storage adapter interface and implementations."""

import shutil
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings
from app.core.logger import logger
from app.core.supabase import get_supabase_admin_client


class StorageAdapter(ABC):
    """Abstract storage adapter interface."""

    @abstractmethod
    async def save_file(
        self, file_content: bytes, file_path: str, content_type: str
    ) -> str:
        """
        Save file to storage.

        Args:
            file_content: File content as bytes
            file_path: Relative path where file should be stored
            content_type: MIME type of the file

        Returns:
            str: Storage path or URL of the saved file
        """

    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """
        Delete file from storage.

        Args:
            file_path: Path to the file to delete

        Returns:
            bool: True if successful, False otherwise
        """
        pass

    @abstractmethod
    async def move_file(self, old_path: str, new_path: str) -> bool:
        """
        Move file from one location to another.

        Args:
            old_path: Current file path
            new_path: New file path

        Returns:
            bool: True if successful, False otherwise
        """
        pass

    @abstractmethod
    async def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists in storage.

        Args:
            file_path: Path to check

        Returns:
            bool: True if file exists, False otherwise
        """
        pass

    @abstractmethod
    async def read_file(self, file_path: str) -> bytes:
        """
        Read file content from storage.

        Args:
            file_path: Path to the file to read

        Returns:
            bytes: File content

        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass


class LocalStorageAdapter(StorageAdapter):
    """Local filesystem storage adapter."""

    def __init__(self, base_path: str | None = None):
        """
        Initialize local storage adapter.

        Args:
            base_path: Base directory for storage (defaults to settings.STORAGE_PATH)
        """
        self.base_path = Path(base_path or settings.STORAGE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorageAdapter initialized with base path: {self.base_path}")

    async def save_file(
        self, file_content: bytes, file_path: str, content_type: str
    ) -> str:
        """Save file to local filesystem."""
        try:
            full_path = self.base_path / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)

            with open(full_path, "wb") as f:
                f.write(file_content)

            logger.debug(f"Saved file to local storage: {file_path}; Absolute path: {full_path.absolute()}")
            return file_path

        except Exception as e:
            logger.error(f"Error saving file to local storage: {str(e)}")
            raise

    async def delete_file(self, file_path: str) -> bool:
        """Delete file from local filesystem."""
        try:
            full_path = self.base_path / file_path
            if full_path.exists():
                full_path.unlink()
                logger.debug(f"Deleted file from local storage: {file_path}")
                return True
            else:
                logger.warning(f"File not found for deletion: {file_path}")
                return False

        except Exception as e:
            logger.error(f"Error deleting file from local storage: {str(e)}")
            return False

    async def move_file(self, old_path: str, new_path: str) -> bool:
        """Move file within local filesystem."""
        try:
            old_full_path = self.base_path / old_path
            new_full_path = self.base_path / new_path

            if not old_full_path.exists():
                logger.warning(f"Source file not found for move: {old_path}")
                return False

            # Create destination directory
            new_full_path.parent.mkdir(parents=True, exist_ok=True)

            # Move file
            shutil.move(str(old_full_path), str(new_full_path))
            logger.debug(f"Moved file from {old_path} to {new_path}")
            return True

        except Exception as e:
            logger.error(f"Error moving file in local storage: {str(e)}")
            return False

    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists in local filesystem."""
        full_path = self.base_path / file_path
        return full_path.exists()

    async def read_file(self, file_path: str) -> bytes:
        """Read file from local filesystem."""
        try:
            full_path = self.base_path / file_path
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            with open(full_path, "rb") as f:
                return f.read()

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error reading file from local storage: {str(e)}")
            raise


class SupabaseStorageAdapter(StorageAdapter):
    """Supabase Storage adapter (S3-compatible storage)."""

    def __init__(self, bucket_name: str | None = None):
        """
        Initialize Supabase storage adapter.

        Args:
            bucket_name: Supabase storage bucket name (defaults to settings.SUPABASE_STORAGE_BUCKET)
        """
        self.bucket_name = bucket_name or settings.SUPABASE_STORAGE_BUCKET
        self.client = get_supabase_admin_client()

        if not self.client:
            logger.warning(
                "Supabase client not configured. Falling back to LocalStorageAdapter."
            )

        logger.info(
            f"SupabaseStorageAdapter initialized with bucket: {self.bucket_name}"
        )

    async def save_file(
        self, file_content: bytes, file_path: str, content_type: str
    ) -> str:
        """Save file to Supabase Storage."""
        try:
            if not self.client:
                raise RuntimeError("Supabase client not configured")

            # Upload to Supabase storage
            self.client.storage.from_(self.bucket_name).upload(
                file_path, file_content, {"content-type": content_type}
            )

            logger.debug(f"Saved file to Supabase storage: {file_path}")
            logger.debug(f"Supabase bucket: {self.bucket_name}, path: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error saving file to Supabase storage: {str(e)}")
            raise

    async def delete_file(self, file_path: str) -> bool:
        """Delete file from Supabase Storage."""
        try:
            if not self.client:
                raise RuntimeError("Supabase client not configured")

            self.client.storage.from_(self.bucket_name).remove([file_path])
            logger.debug(f"Deleted file from Supabase storage: {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file from Supabase storage: {str(e)}")
            return False

    async def move_file(self, old_path: str, new_path: str) -> bool:
        """Move file within Supabase Storage."""
        try:
            if not self.client:
                raise RuntimeError("Supabase client not configured")

            # Supabase storage: copy then delete
            self.client.storage.from_(self.bucket_name).move(old_path, new_path)
            logger.debug(f"Moved file in Supabase storage from {old_path} to {new_path}")
            return True

        except Exception as e:
            logger.error(f"Error moving file in Supabase storage: {str(e)}")
            return False

    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists in Supabase Storage."""
        try:
            if not self.client:
                return False

            # Try to list the file
            result = self.client.storage.from_(self.bucket_name).list(
                path=str(Path(file_path).parent), search=Path(file_path).name
            )
            return len(result) > 0

        except Exception:
            return False

    async def read_file(self, file_path: str) -> bytes:
        """Read file from Supabase Storage."""
        try:
            if not self.client:
                raise RuntimeError("Supabase client not configured")

            # Download file from Supabase
            file_bytes = self.client.storage.from_(self.bucket_name).download(file_path)

            if not file_bytes:
                raise FileNotFoundError(f"File not found in Supabase storage: {file_path}")

            logger.debug(f"Downloaded file from Supabase storage: {file_path}")
            return file_bytes

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error reading file from Supabase storage: {str(e)}")
            raise


# Default storage adapter instance
_default_adapter: StorageAdapter | None = None


def get_storage_adapter() -> StorageAdapter:
    """
    Get the default storage adapter instance.

    Priority:
    1. Use STORAGE_BACKEND setting ("supabase" or "local")
    2. If "supabase" but not configured, fall back to local with warning
    3. If "local", use local storage

    Returns:
        StorageAdapter: The configured storage adapter
    """
    global _default_adapter

    if _default_adapter is None:
        if settings.STORAGE_BACKEND == "supabase":
            # Default: Try Supabase first
            if settings.supabase_enabled:
                try:
                    _default_adapter = SupabaseStorageAdapter()
                    logger.info("✅ Using SupabaseStorageAdapter (default)")
                except Exception as e:
                    logger.warning(
                        f"⚠️ Failed to initialize SupabaseStorageAdapter: {str(e)}. "
                        f"Falling back to LocalStorageAdapter."
                    )
                    _default_adapter = LocalStorageAdapter()
            else:
                logger.warning(
                    "⚠️ STORAGE_BACKEND=supabase but Supabase not configured. "
                    "Set SUPABASE_URL and SUPABASE_KEY, or change STORAGE_BACKEND=local. "
                    "Falling back to LocalStorageAdapter."
                )
                _default_adapter = LocalStorageAdapter()
        elif settings.STORAGE_BACKEND == "local":
            _default_adapter = LocalStorageAdapter()
            logger.info("✅ Using LocalStorageAdapter (configured)")
        else:
            raise ValueError(f"Invalid STORAGE_BACKEND setting: {settings.STORAGE_BACKEND}")

    return _default_adapter
