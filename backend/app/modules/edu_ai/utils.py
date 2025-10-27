"""
Minimal utility functions for Educational AI module.
Simple JSON handling utilities since model methods handle most functionality.
"""

import json
from datetime import datetime
from typing import Any

from sqlmodel import select

from app.core.logger import logger
from app.models.api_key import APIKey


def safe_json_serialize(data: Any) -> str:
    """Safely serialize data to JSON string."""
    try:
        return json.dumps(data, default=str)
    except (TypeError, ValueError) as e:
        logger.error(f"Error dumping to JSON: {e}")
        return "{}"


def safe_json_deserialize(json_string: str | None, default: Any = None) -> Any:
    """Safely deserialize JSON string to Python object."""
    if not json_string:
        return default
    try:
        return json.loads(json_string)
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"Error loading JSON: {e}")
        return default


def validate_json_string(json_string: str) -> bool:
    """Validate if string is valid JSON."""
    try:
        json.loads(json_string)
        return True
    except (json.JSONDecodeError, TypeError):
        return False


def validate_api_key(session, api_key: str) -> tuple[bool, APIKey | None]:
    """
    Validate API key and return validation status and API key object.

    Args:
        session: Database session
        api_key: API key string to validate

    Returns:
        Tuple of (is_valid, api_key_object)
    """
    try:
        # Query for API key by public key
        query = select(APIKey).where(
            APIKey.public_key == api_key, APIKey.status == "active"
        )
        result = session.exec(query).first()

        if not result:
            logger.warning(f"Invalid API key: {api_key}")
            return False, None

        # Check if API key is expired
        if result.expires_at and result.expires_at < datetime.now():
            logger.warning(f"Expired API key: {api_key}")
            return False, None

        logger.info(f"Valid API key: {api_key}")
        return True, result

    except Exception as e:
        logger.error(f"Error validating API key: {e}")
        return False, None


def check_api_key_access(session, api_key: str, project_id: str | None = None) -> bool:
    """
    Check if API key has access to the requested resource.

    Args:
        session: Database session
        api_key: API key string
        project_id: Optional project ID to check access for

    Returns:
        True if access is granted, False otherwise
    """
    is_valid, api_key_obj = validate_api_key(session, api_key)

    if not is_valid or not api_key_obj:
        return False

    # If project_id is specified, check if API key has access to it
    if project_id and api_key_obj.project_id:
        return str(api_key_obj.project_id) == str(project_id)

    # If no project_id specified or API key has no project restriction
    return True
