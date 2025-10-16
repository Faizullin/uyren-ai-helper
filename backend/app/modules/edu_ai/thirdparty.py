"""
Third-party API Integration
Fetches student submission data from external learning management systems
"""
import httpx
from typing import Any

from app.core.logger import logger


class ThirdPartyClient:
    """
    Client for fetching submission data from external APIs
    Handles authentication and data transformation
    """
    
    def __init__(self, base_url: str, api_key: str | None = None):
        """
        Initialize client with API credentials
        
        Args:
            base_url: Base URL of the third-party API (e.g., "https://api.classroom.com")
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = 30.0  # 30 second timeout for API calls
    
    async def fetch_submissions(
        self, 
        assignment_id: str,
        page_size: int = 50,
        page: int = 1
    ) -> dict[str, Any]:
        """
        Fetch submissions for a given assignment (paginated)
        
        This method calls the third-party API to get student submissions.
        Supports pagination for large assignment sets.
        
        Args:
            assignment_id: The third-party's internal assignment ID
            page_size: Number of submissions per page (default: 50)
            page: Page number to fetch (default: 1)
            
        Returns:
            Dictionary with submissions and pagination info:
            {
                "submissions": [...],
                "page": 1,
                "page_size": 50,
                "total": 150,
                "has_more": true
            }
            
        Example submission format:
        {
            "submission_id": "ext_12345",
            "student": {...},
            "submission": {
                "content": "...",  # For assignments
                "answers": {...},  # For quizzes
                "files": [...]
            }
        }
        """
        logger.info(f"[THIRDPARTY] Fetching page {page} (size={page_size}) for assignment {assignment_id}")
        
        # Build request headers
        headers = {
            "Accept": "application/json",
            "User-Agent": "EduAI-Grading/1.0"
        }
        
        # Add authentication if API key provided
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        # Construct API endpoint with pagination params
        endpoint = f"{self.base_url}/api/v1/assignments/{assignment_id}/submissions"
        params = {
            "page": page,
            "page_size": page_size
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.debug(f"[THIRDPARTY] GET {endpoint} (page={page})")
                
                response = await client.get(endpoint, headers=headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                
                # Handle different response formats
                if isinstance(data, dict):
                    # Standard paginated response
                    if "submissions" in data:
                        return {
                            "submissions": data.get("submissions", []),
                            "page": data.get("page", page),
                            "page_size": data.get("page_size", page_size),
                            "total": data.get("total", len(data.get("submissions", []))),
                            "has_more": data.get("has_more", False)
                        }
                    elif "data" in data:
                        # Alternative format
                        submissions = data["data"]
                        return {
                            "submissions": submissions,
                            "page": data.get("page", page),
                            "page_size": data.get("page_size", page_size),
                            "total": data.get("total", len(submissions)),
                            "has_more": data.get("has_more", False)
                        }
                elif isinstance(data, list):
                    # Non-paginated response (legacy)
                    return {
                        "submissions": data,
                        "page": 1,
                        "page_size": len(data),
                        "total": len(data),
                        "has_more": False
                    }
                
                logger.error(f"[THIRDPARTY] Unexpected response format: {type(data)}")
                return {
                    "submissions": [],
                    "page": page,
                    "page_size": page_size,
                    "total": 0,
                    "has_more": False
                }
                
        except httpx.HTTPStatusError as e:
            logger.error(f"[THIRDPARTY] HTTP error {e.response.status_code}: {e.response.text}")
            raise Exception(f"Failed to fetch submissions: {e.response.status_code}")
        
        except httpx.TimeoutException:
            logger.error(f"[THIRDPARTY] Request timeout after {self.timeout}s")
            raise Exception("Third-party API timeout")
        
        except Exception as e:
            logger.error(f"[THIRDPARTY] Unexpected error: {str(e)}")
            raise
    
    async def fetch_all_submissions(
        self,
        assignment_id: str,
        page_size: int = 50
    ) -> list[dict[str, Any]]:
        """
        Fetch ALL submissions by iterating through pages
        
        Args:
            assignment_id: The third-party's internal assignment ID
            page_size: Number of submissions per page
            
        Returns:
            List of all submission dictionaries
        """
        logger.info(f"[THIRDPARTY] Fetching all submissions for assignment {assignment_id}")
        
        all_submissions = []
        page = 1
        has_more = True
        
        while has_more:
            result = await self.fetch_submissions(assignment_id, page_size, page)
            all_submissions.extend(result["submissions"])
            has_more = result["has_more"]
            page += 1
            
            logger.debug(f"[THIRDPARTY] Fetched {len(result['submissions'])} submissions (total: {len(all_submissions)})")
        
        logger.info(f"[THIRDPARTY] Completed fetching {len(all_submissions)} total submissions")
        return all_submissions
    
    async def fetch_single_submission(self, submission_id: str) -> dict[str, Any]:
        """
        Fetch a single submission by ID
        
        Args:
            submission_id: The third-party's internal submission ID
            
        Returns:
            Submission dictionary with student data
        """
        logger.info(f"[THIRDPARTY] Fetching submission {submission_id}")
        
        headers = {
            "Accept": "application/json",
            "User-Agent": "EduAI-Grading/1.0"
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        endpoint = f"{self.base_url}/api/v1/submissions/{submission_id}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(endpoint, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                logger.debug(f"[THIRDPARTY] Fetched submission {submission_id}")
                return data
                
        except Exception as e:
            logger.error(f"[THIRDPARTY] Error fetching submission: {str(e)}")
            raise
    
    async def download_file(self, file_url: str) -> bytes:
        """
        Download a file from the third-party system
        
        Used when students upload files (PDFs, code files, etc.)
        
        Args:
            file_url: URL of the file to download
            
        Returns:
            File content as bytes
        """
        logger.debug(f"[THIRDPARTY] Downloading file: {file_url}")
        
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for files
                response = await client.get(file_url, headers=headers)
                response.raise_for_status()
                
                logger.debug(f"[THIRDPARTY] Downloaded {len(response.content)} bytes")
                return response.content
                
        except Exception as e:
            logger.error(f"[THIRDPARTY] Error downloading file: {str(e)}")
            raise


    async def submit_grade_webhook(
        self,
        webhook_url: str,
        submission_id: str,
        grade_data: dict[str, Any]
    ) -> bool:
        """
        Submit grading results back to third-party via webhook
        
        Args:
            webhook_url: URL to POST results to
            submission_id: The third-party's submission ID
            grade_data: Grading results to submit
            
        Example grade_data:
        {
            "submission_id": "ext_12345",
            "grade": 85.5,
            "max_points": 100,
            "feedback": "Great work!...",
            "rubric_scores": {...},
            "graded_at": "2025-10-12T11:00:00Z"
        }
        
        Returns:
            True if successful, raises exception otherwise
        """
        logger.info(f"[THIRDPARTY] Submitting grade for submission {submission_id} to {webhook_url}")
        
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "EduAI-Grading/1.0"
        }
        
        # Add authentication if API key provided
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        # Ensure submission_id is in payload
        payload = {
            **grade_data,
            "submission_id": submission_id
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.debug(f"[THIRDPARTY] POST {webhook_url}")
                
                response = await client.post(
                    webhook_url,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                
                logger.info(f"[THIRDPARTY] Successfully submitted grade for {submission_id}")
                return True
                
        except httpx.HTTPStatusError as e:
            logger.error(f"[THIRDPARTY] Webhook error {e.response.status_code}: {e.response.text}")
            raise Exception(f"Failed to submit grade via webhook: {e.response.status_code}")
        
        except Exception as e:
            logger.error(f"[THIRDPARTY] Webhook error: {str(e)}")
            raise


def create_client(api_url: str, api_key: str | None = None) -> ThirdPartyClient:
    """
    Factory function to create a configured third-party client
    
    Args:
        api_url: Base URL of the third-party API
        api_key: Optional API key
        
    Returns:
        Configured ThirdPartyClient instance
    """
    return ThirdPartyClient(api_url, api_key)

