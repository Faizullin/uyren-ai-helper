"""LMS data fetcher for educational content."""

import asyncio
import uuid
from typing import Any

from app.core.logger import logger
from app.services.storage_service import StorageService


class LMSFetcher:
    """Fetcher for loading data from Learning Management Systems."""

    def __init__(self, storage_service: StorageService):
        """Initialize the LMS fetcher."""
        self.storage_service = storage_service

    async def fetch_course_data(
        self, course_id: str, lms_type: str = "cloudinary"
    ) -> dict[str, Any]:
        """
        Main method to fetch course data from LMS.

        Args:
            course_id: The course identifier
            lms_type: Type of LMS adapter to use (currently only "cloudinary")

        Returns:
            Dictionary containing fetched course data and file information
        """
        try:
            logger.info(
                f"Fetching course data for course_id: {course_id}, lms_type: {lms_type}"
            )

            # Get course composition data
            course_data = await self._get_course_composition(course_id, lms_type)

            # Get downloadable links
            download_links = await self._get_download_links(course_id, lms_type)

            # Download and store files using storage service
            stored_files = await self._download_and_store_files(download_links)

            # Combine all data
            result = {
                "course_id": course_id,
                "lms_type": lms_type,
                "course_data": course_data,
                "download_links": download_links,
                "stored_files": stored_files,
                "status": "success",
            }

            logger.info(f"Successfully fetched course data for {course_id}")
            return result

        except Exception as e:
            logger.error(f"Error fetching course data for {course_id}: {str(e)}")
            return {
                "course_id": course_id,
                "lms_type": lms_type,
                "status": "error",
                "error": str(e),
            }

    async def _get_course_composition(
        self, course_id: str, lms_type: str
    ) -> dict[str, Any]:
        """
        Get course composition data from LMS.

        Args:
            course_id: The course identifier
            lms_type: Type of LMS adapter

        Returns:
            Dictionary containing course composition data
        """
        try:
            # Get adapter for the specified LMS type
            adapter = self._get_adapter(lms_type)

            # Fetch course composition using adapter
            course_composition = await adapter.get_course_composition(course_id)

            logger.info(f"Retrieved course composition for {course_id}")
            return course_composition

        except Exception as e:
            logger.error(f"Error getting course composition for {course_id}: {str(e)}")
            raise e

    async def _get_download_links(
        self, course_id: str, lms_type: str
    ) -> list[dict[str, Any]]:
        """
        Get downloadable links from LMS.

        Args:
            course_id: The course identifier
            lms_type: Type of LMS adapter

        Returns:
            List of dictionaries containing download link information
        """
        try:
            # Get adapter for the specified LMS type
            adapter = self._get_adapter(lms_type)

            # Fetch download links using adapter
            download_links = await adapter.get_download_links(course_id)

            logger.info(
                f"Retrieved {len(download_links)} download links for {course_id}"
            )
            return download_links

        except Exception as e:
            logger.error(f"Error getting download links for {course_id}: {str(e)}")
            raise e

    async def _download_and_store_files(
        self, download_links: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Download files from public URLs and store them using storage service.

        Args:
            download_links: List of download link dictionaries

        Returns:
            List of dictionaries containing stored file information
        """
        stored_files = []

        for link_info in download_links:
            try:
                # Extract file information
                file_url = link_info.get("url")
                file_name = link_info.get("name", "unknown_file")
                file_type = link_info.get("type", "unknown")

                if not file_url:
                    logger.warning(f"Skipping link without URL: {link_info}")
                    continue

                logger.info(f"Downloading file: {file_name} from {file_url}")

                # Download file content
                file_content = await self._download_file_from_url(file_url)

                # Store file using storage service
                stored_file_info = await self._store_file_with_service(
                    file_content, file_name, file_type, link_info
                )

                stored_files.append(stored_file_info)
                logger.info(f"Successfully stored file: {file_name}")

            except Exception as e:
                logger.error(
                    f"Error processing file {link_info.get('name', 'unknown')}: {str(e)}"
                )
                # Continue processing other files
                continue

        return stored_files

    async def _download_file_from_url(self, url: str) -> bytes:
        """
        Download file content from public URL.

        Args:
            url: Public URL to download from

        Returns:
            File content as bytes
        """
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.read()
                else:
                    raise Exception(
                        f"Failed to download file from {url}: HTTP {response.status}"
                    )

    async def _store_file_with_service(
        self,
        file_content: bytes,
        file_name: str,
        file_type: str,
        link_info: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Store file using the existing storage service.

        Args:
            file_content: File content as bytes
            file_name: Name of the file
            file_type: Type/category of the file
            link_info: Original link information

        Returns:
            Dictionary containing stored file information
        """
        try:
            # Generate unique file path
            file_id = str(uuid.uuid4())
            file_extension = self._get_file_extension(file_name)
            storage_path = f"edu_ai/files/{file_type}/{file_id}{file_extension}"

            # Store file using storage service
            stored_url = await self.storage_service.upload_file(
                file_content=file_content,
                file_path=storage_path,
                content_type=self._get_content_type(file_extension),
            )

            return {
                "original_name": file_name,
                "original_url": link_info.get("url"),
                "stored_path": storage_path,
                "stored_url": stored_url,
                "file_type": file_type,
                "file_size": len(file_content),
                "metadata": {
                    "lms_info": link_info,
                    "uploaded_at": self._get_current_timestamp(),
                },
            }

        except Exception as e:
            logger.error(f"Error storing file {file_name}: {str(e)}")
            raise e

    def _get_adapter(self, lms_type: str):
        """
        Get LMS adapter for the specified type.

        Args:
            lms_type: Type of LMS adapter

        Returns:
            LMS adapter instance
        """
        if lms_type == "cloudinary":
            return CloudinaryAdapter()
        else:
            raise ValueError(f"Unsupported LMS type: {lms_type}")

    def _get_file_extension(self, file_name: str) -> str:
        """Get file extension from file name."""
        if "." in file_name:
            return "." + file_name.split(".")[-1]
        return ""

    def _get_content_type(self, file_extension: str) -> str:
        """Get content type based on file extension."""
        content_types = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".ppt": "application/vnd.ms-powerpoint",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".txt": "text/plain",
            ".mp4": "video/mp4",
            ".mp3": "audio/mpeg",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
        }
        return content_types.get(file_extension.lower(), "application/octet-stream")

    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string."""
        from datetime import datetime

        return datetime.utcnow().isoformat()


class CloudinaryAdapter:
    """Adapter for Cloudinary LMS integration."""

    async def get_course_composition(self, course_id: str) -> dict[str, Any]:
        """
        Get course composition from Cloudinary.

        Args:
            course_id: The course identifier

        Returns:
            Dictionary containing course composition data
        """
        # Placeholder implementation for Cloudinary course composition
        # This would integrate with Cloudinary's API to get course structure
        return {
            "course_id": course_id,
            "title": f"Course {course_id}",
            "description": "Course description from Cloudinary",
            "modules": [
                {
                    "id": "module_1",
                    "title": "Introduction Module",
                    "lessons": [
                        {"id": "lesson_1", "title": "Lesson 1", "content_type": "video"}
                    ],
                }
            ],
            "metadata": {
                "lms_provider": "cloudinary",
                "last_updated": self._get_current_timestamp(),
            },
        }

    async def get_download_links(self, course_id: str) -> list[dict[str, Any]]:
        """
        Get downloadable links from Cloudinary.

        Args:
            course_id: The course identifier

        Returns:
            List of dictionaries containing download link information
        """
        # Placeholder implementation for Cloudinary download links
        # This would integrate with Cloudinary's API to get file URLs
        permissions = [
            {
                "url": "https://res.cloudinary.com/example/video/upload/course1_intro.mp4",
                "name": "course_introduction.mp4",
                "type": "video",
                "size": 1024000,
                "description": "Course introduction video",
            },
            {
                "url": "https://res.cloudinary.com/example/document/upload/course1_notes.pdf",
                "name": "course_notes.pdf",
                "type": "document",
                "size": 512000,
                "description": "Course notes and materials",
            },
        ]

        return permissions

    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string."""
        from datetime import datetime

        return datetime.utcnow().isoformat()


# Factory function for creating LMS fetcher
def create_lms_fetcher(storage_service: StorageService) -> LMSFetcher:
    """
    Create an LMS fetcher instance.

    Args:
        storage_service: Storage service instance

    Returns:
        LMSFetcher instance
    """
    return LMSFetcher(storage_service)
