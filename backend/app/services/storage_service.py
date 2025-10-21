"""Generic storage service for handling file operations across modules."""

import uuid
from typing import Any

import aiohttp

from app.core.logger import logger
from app.services.storage_adapter import StorageAdapter, get_storage_adapter


class StorageService:
    """Generic service for managing file storage operations."""

    def __init__(self, adapter: StorageAdapter | None = None, prefix: str = ""):
        """
        Initialize storage service with optional adapter and prefix.

        Args:
            adapter: Storage adapter to use (defaults to configured adapter)
            prefix: Base prefix for all file paths (e.g., "knowledge-base", "edu-ai")
        """
        self.adapter = adapter or get_storage_adapter()
        self.prefix = prefix.strip("/")

    def _build_path(self, *parts: str | uuid.UUID) -> str:
        """
        Build a file path from parts.

        Args:
            *parts: Path components (strings or UUIDs)

        Returns:
            str: Constructed file path
        """
        path_parts = [str(part) for part in parts if part]
        if self.prefix:
            path_parts.insert(0, self.prefix)
        return "/".join(path_parts)

    async def save_file(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        path_parts: list[str | uuid.UUID] | None = None,
        **kwargs: Any,
    ) -> str:
        """
        Save a file to storage.

        Args:
            file_content: File content as bytes
            filename: Filename
            mime_type: MIME type of the file
            path_parts: Optional path components (folders, IDs, etc.)
            **kwargs: Additional metadata (logged but not used in basic storage)

        Returns:
            str: Storage path of the saved file

        Example:
            # Knowledge base: knowledge-base/{folder_id}/{entry_id}/file.pdf
            path = await service.save_file(
                content, "file.pdf", "application/pdf",
                path_parts=[folder_id, entry_id]
            )

            # Edu AI: edu-ai/{assignment_id}/submissions/{submission_id}/essay.pdf
            path = await service.save_file(
                content, "essay.pdf", "application/pdf",
                path_parts=["submissions", submission_id]
            )
        """
        parts = path_parts or []
        parts.append(filename)
        file_path = self._build_path(*parts)

        try:
            stored_path = await self.adapter.save_file(
                file_content=file_content, file_path=file_path, content_type=mime_type
            )
            logger.info(f"Saved file to storage: {stored_path}")
            return stored_path

        except Exception as e:
            logger.error(f"Failed to save file {filename}: {str(e)}")
            raise

    async def save_from_url(
        self,
        url: str,
        filename: str,
        mime_type: str | None = None,
        path_parts: list[str | uuid.UUID] | None = None,
        timeout: int = 30,
        **kwargs: Any,
    ) -> str:
        """
        Download file from URL and save to storage.

        Args:
            url: URL to download from
            filename: Filename to save as
            mime_type: MIME type (auto-detected if None)
            path_parts: Optional path components
            timeout: Download timeout in seconds
            **kwargs: Additional metadata

        Returns:
            str: Storage path of the saved file

        Example:
            # Download external resource for edu_ai
            path = await service.save_from_url(
                "https://example.com/document.pdf",
                "reference.pdf",
                path_parts=[assignment_id, "references"]
            )
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=timeout) as response:
                    response.raise_for_status()
                    file_content = await response.read()

                    # Auto-detect MIME type if not provided
                    if mime_type is None:
                        mime_type = response.headers.get(
                            "content-type", "application/octet-stream"
                        )

            logger.info(f"Downloaded {len(file_content)} bytes from {url}")

            return await self.save_file(
                file_content=file_content,
                filename=filename,
                mime_type=mime_type,
                path_parts=path_parts,
                source_url=url,
                **kwargs,
            )

        except Exception as e:
            logger.error(f"Failed to download and save from {url}: {str(e)}")
            raise

    async def delete_file(self, file_path: str) -> bool:
        """
        Delete a file from storage.

        Args:
            file_path: Path to the file to delete

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            success = await self.adapter.delete_file(file_path)
            if success:
                logger.info(f"Deleted file: {file_path}")
            else:
                logger.warning(f"File not found or already deleted: {file_path}")
            return success

        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {str(e)}")
            return False

    async def move_file(
        self, old_path: str, new_path_parts: list[str | uuid.UUID], filename: str
    ) -> str:
        """
        Move a file to a new location.

        Args:
            old_path: Current file path
            new_path_parts: New path components
            filename: Filename

        Returns:
            str: New storage path
        """
        parts = new_path_parts + [filename]
        new_path = self._build_path(*parts)

        try:
            success = await self.adapter.move_file(old_path, new_path)
            if success:
                logger.info(f"Moved file from {old_path} to {new_path}")
                return new_path
            else:
                raise RuntimeError(f"Failed to move file from {old_path} to {new_path}")

        except Exception as e:
            logger.error(f"Failed to move file: {str(e)}")
            raise

    async def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists in storage.

        Args:
            file_path: Path to check

        Returns:
            bool: True if file exists
        """
        return await self.adapter.file_exists(file_path)

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
        try:
            file_content = await self.adapter.read_file(file_path)
            logger.info(f"Read file from storage: {file_path}")
            return file_content

        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
            raise
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {str(e)}")
            raise


# Module-specific storage service factory (for convenience)
def get_knowledge_base_storage() -> StorageService:
    """
    Get storage service for knowledge base module.

    Returns:
        StorageService: Service with "knowledge-base" prefix
    """
    return StorageService(prefix="knowledge-base")


# Global default storage service (no prefix)
_default_storage: StorageService | None = None


def get_storage_service(prefix: str = "") -> StorageService:
    """
    Get storage service instance.

    Args:
        prefix: Optional prefix for file paths

    Returns:
        StorageService: The storage service instance
    """
    if prefix:
        return StorageService(prefix=prefix)

    global _default_storage
    if _default_storage is None:
        _default_storage = StorageService()

    return _default_storage
