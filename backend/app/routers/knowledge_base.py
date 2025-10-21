"""Knowledge Base routes."""

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.db import SessionDep
from app.core.logger import logger
from app.crud import knowledge_base as kb_crud
from app.schemas.common import Message
from app.schemas.knowledge_base import (
    AgentKnowledgeAssignmentRequest,
    FileMoveRequest,
    FileUploadResponse,
    KnowledgeBaseEntryPublic,
    KnowledgeBaseEntryUpdate,
    KnowledgeBaseFolderCreate,
    KnowledgeBaseFolderPublic,
    KnowledgeBaseFolderUpdate,
    KnowledgeBaseStats,
)
from app.services.knowledge_base_processor import KnowledgeBaseFileProcessor
from app.services.storage_service import get_storage_service
from app.utils.authentication import CurrentUser
from app.utils.knowledge_base_validation import FileNameValidator, ValidationError

router = APIRouter(tags=["knowledge-base"])

# Constants
MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024  # 50MB total limit per user

# Initialize services
file_processor = KnowledgeBaseFileProcessor()
storage_service = get_storage_service(prefix="knowledge-base")


# ==================== Helper Functions ====================


def check_total_file_size_limit(
    session: SessionDep, user_id: uuid.UUID, new_file_size: int
) -> None:
    """Check if adding a new file would exceed the total file size limit."""
    current_total_size = kb_crud.get_total_file_size_for_user(session, user_id)
    new_total_size = current_total_size + new_file_size

    if new_total_size > MAX_TOTAL_FILE_SIZE:
        current_mb = current_total_size / (1024 * 1024)
        new_mb = new_file_size / (1024 * 1024)
        limit_mb = MAX_TOTAL_FILE_SIZE / (1024 * 1024)

        raise HTTPException(
            status_code=413,
            detail=f"File size limit exceeded. Current total: {current_mb:.1f}MB, New file: {new_mb:.1f}MB, Limit: {limit_mb}MB",
        )


# ==================== Folder Endpoints ====================


@router.get(
    "/knowledge-base/folders",
    response_model=list[KnowledgeBaseFolderPublic],
    summary="List Knowledge Base Folders",
    operation_id="list_kb_folders",
)
async def list_folders(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> list[KnowledgeBaseFolderPublic]:
    """Get all knowledge base folders for the current user."""
    try:
        folders = kb_crud.get_folders(session, current_user.id, skip=skip, limit=limit)

        # Add entry count to each folder
        result = []
        for folder in folders:
            entry_count = kb_crud.get_folder_entry_count(session, folder.id)
            folder_data = KnowledgeBaseFolderPublic.model_validate(folder)
            folder_data.entry_count = entry_count
            result.append(folder_data)

        return result
    except Exception as e:
        logger.error(f"Error getting folders: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve folders")


@router.post(
    "/knowledge-base/folders",
    response_model=KnowledgeBaseFolderPublic,
    summary="Create Knowledge Base Folder",
    operation_id="create_kb_folder",
)
async def create_folder(
    session: SessionDep,
    folder_data: KnowledgeBaseFolderCreate,
    current_user: CurrentUser,
) -> KnowledgeBaseFolderPublic:
    """Create a new knowledge base folder."""
    try:
        # Validate folder name
        is_valid, error_message = FileNameValidator.validate_name(
            folder_data.name, "folder"
        )
        if not is_valid:
            raise ValidationError(error_message)

        # Get existing folder names to check for conflicts
        existing_names = kb_crud.get_existing_folder_names(session, current_user.id)

        # Generate unique name if there's a conflict
        final_name = FileNameValidator.generate_unique_name(
            folder_data.name, existing_names, "folder"
        )

        # Create folder with final name
        folder_create = KnowledgeBaseFolderCreate(
            name=final_name, description=folder_data.description
        )
        folder = kb_crud.create_folder(session, folder_create, current_user.id)

        logger.info(f"Created folder {folder.id} for user {current_user.id}")

        folder_public = KnowledgeBaseFolderPublic.model_validate(folder)
        folder_public.entry_count = 0
        return folder_public

    except ValidationError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create folder")


@router.get(
    "/knowledge-base/folders/{folder_id}",
    response_model=KnowledgeBaseFolderPublic,
    summary="Get Knowledge Base Folder",
    operation_id="get_kb_folder",
)
async def get_folder(
    folder_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseFolderPublic:
    """Get a specific knowledge base folder."""
    folder = kb_crud.get_folder_by_id(session, folder_id, current_user.id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    entry_count = kb_crud.get_folder_entry_count(session, folder.id)
    folder_public = KnowledgeBaseFolderPublic.model_validate(folder)
    folder_public.entry_count = entry_count
    return folder_public


@router.put(
    "/knowledge-base/folders/{folder_id}",
    response_model=KnowledgeBaseFolderPublic,
    summary="Update Knowledge Base Folder",
    operation_id="update_kb_folder",
)
async def update_folder(
    folder_id: uuid.UUID,
    folder_data: KnowledgeBaseFolderUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseFolderPublic:
    """Update a knowledge base folder."""
    try:
        # Get folder
        folder = kb_crud.get_folder_by_id(session, folder_id, current_user.id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Validate name if provided
        if folder_data.name is not None:
            is_valid, error_message = FileNameValidator.validate_name(
                folder_data.name, "folder"
            )
            if not is_valid:
                raise ValidationError(error_message)

            # Check uniqueness (excluding current folder)
            existing_names = kb_crud.get_existing_folder_names(session, current_user.id)
            existing_names = [name for name in existing_names if name != folder.name]

            if folder_data.name.lower() in [name.lower() for name in existing_names]:
                raise ValidationError(
                    f"A folder with the name '{folder_data.name}' already exists"
                )

        # Update folder
        folder = kb_crud.update_folder(session, folder, folder_data)

        entry_count = kb_crud.get_folder_entry_count(session, folder.id)
        folder_public = KnowledgeBaseFolderPublic.model_validate(folder)
        folder_public.entry_count = entry_count
        return folder_public

    except ValidationError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating folder: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update folder")


@router.delete(
    "/knowledge-base/folders/{folder_id}",
    response_model=Message,
    summary="Delete Knowledge Base Folder",
    operation_id="delete_kb_folder",
)
async def delete_folder(
    folder_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a knowledge base folder and all its entries."""
    try:
        folder = kb_crud.get_folder_by_id(session, folder_id, current_user.id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Get all entries in the folder to delete their files
        entries = kb_crud.get_folder_entries(session, folder_id, current_user.id)

        # Delete files from storage
        for entry in entries:
            await storage_service.delete_file(entry.file_path)

        # Delete folder (cascade will handle entries and assignments)
        kb_crud.delete_folder(session, folder)

        logger.info(f"Deleted folder {folder_id} and {len(entries)} files")
        return Message(message="Folder deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting folder: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete folder")


# ==================== Entry Endpoints ====================


@router.get(
    "/knowledge-base/folders/{folder_id}/entries",
    response_model=list[KnowledgeBaseEntryPublic],
    summary="List Folder Entries",
    operation_id="list_folder_entries",
)
async def list_folder_entries(
    folder_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> list[KnowledgeBaseEntryPublic]:
    """Get all entries in a folder."""
    try:
        # Verify folder ownership
        folder = kb_crud.get_folder_by_id(session, folder_id, current_user.id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        entries = kb_crud.get_folder_entries(
            session, folder_id, current_user.id, skip=skip, limit=limit
        )
        return [KnowledgeBaseEntryPublic.model_validate(entry) for entry in entries]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting folder entries: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve entries")


@router.post(
    "/knowledge-base/folders/{folder_id}/upload",
    response_model=FileUploadResponse,
    summary="Upload File to Folder",
    operation_id="upload_file_to_folder",
)
async def upload_file(
    folder_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> FileUploadResponse:
    """Upload a file to a knowledge base folder."""
    try:
        # Verify folder ownership
        folder = kb_crud.get_folder_by_id(session, folder_id, current_user.id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Validate filename
        if not file.filename:
            raise ValidationError("Filename is required")

        is_valid, error_message = FileNameValidator.validate_name(file.filename, "file")
        if not is_valid:
            raise ValidationError(error_message)

        # Read file content
        file_content = await file.read()

        # Check total file size limit
        check_total_file_size_limit(session, current_user.id, len(file_content))

        # Generate unique filename if there's a conflict
        existing_filenames = kb_crud.get_existing_filenames_in_folder(
            session, folder_id
        )
        final_filename = FileNameValidator.generate_unique_name(
            file.filename, existing_filenames, "file"
        )

        # Generate entry ID
        entry_id = uuid.uuid4()

        # Sanitize filename for storage
        safe_filename = file_processor.sanitize_filename(final_filename)

        # Process file (extract content, generate summary)
        process_result = await file_processor.process_file(
            file_content=file_content,
            filename=final_filename,
            mime_type=file.content_type or "application/octet-stream",
        )

        if not process_result["success"]:
            raise HTTPException(status_code=400, detail=process_result["error"])

        # Save file to storage
        try:
            file_path = await storage_service.save_file(
                file_content=file_content,
                filename=safe_filename,
                mime_type=file.content_type or "application/octet-stream",
                path_parts=[str(folder_id), str(entry_id)],
            )
        except Exception as e:
            logger.error(f"Failed to save file to storage: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to save file to storage"
            )

        # Create database entry
        entry = kb_crud.create_entry(
            session=session,
            folder_id=folder_id,
            owner_id=current_user.id,
            filename=final_filename,
            file_path=file_path,
            file_size=len(file_content),
            mime_type=file.content_type or "application/octet-stream",
            summary=process_result["summary"],
        )

        logger.info(f"Uploaded file {entry.id} to folder {folder_id}")

        return FileUploadResponse(
            success=True,
            entry_id=entry.id,
            filename=final_filename,
            summary=process_result["summary"],
            file_size=len(file_content),
            filename_changed=final_filename != file.filename,
            original_filename=file.filename
            if final_filename != file.filename
            else None,
        )

    except ValidationError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload file")


@router.get(
    "/knowledge-base/entries/{entry_id}",
    response_model=KnowledgeBaseEntryPublic,
    summary="Get Knowledge Base Entry",
    operation_id="get_kb_entry",
)
async def get_entry(
    entry_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseEntryPublic:
    """Get a specific knowledge base entry."""
    entry = kb_crud.get_entry_by_id(session, entry_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return KnowledgeBaseEntryPublic.model_validate(entry)


@router.patch(
    "/knowledge-base/entries/{entry_id}",
    response_model=KnowledgeBaseEntryPublic,
    summary="Update Knowledge Base Entry",
    operation_id="update_kb_entry",
)
async def update_entry(
    entry_id: uuid.UUID,
    entry_data: KnowledgeBaseEntryUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseEntryPublic:
    """Update a knowledge base entry (summary only)."""
    try:
        entry = kb_crud.get_entry_by_id(session, entry_id, current_user.id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        entry = kb_crud.update_entry(session, entry, entry_data)
        return KnowledgeBaseEntryPublic.model_validate(entry)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating entry: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update entry")


@router.get(
    "/knowledge-base/entries/{entry_id}/download",
    summary="Download Knowledge Base Entry",
    operation_id="download_kb_entry",
)
async def download_entry(
    entry_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> StreamingResponse:
    """Download a knowledge base entry file."""
    try:
        entry = kb_crud.get_entry_by_id(session, entry_id, current_user.id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        # Read file from storage
        try:
            file_content = await storage_service.read_file(entry.file_path)
        except FileNotFoundError:
            logger.error(f"File not found in storage: {entry.file_path}")
            raise HTTPException(status_code=404, detail="File not found in storage")
        except Exception as e:
            logger.error(f"Error reading file from storage: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to read file from storage"
            )

        # Return file as streaming response
        from io import BytesIO

        logger.info(f"Downloaded entry {entry_id}: {entry.filename}")

        return StreamingResponse(
            BytesIO(file_content),
            media_type=entry.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{entry.filename}"',
                "Content-Length": str(entry.file_size),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading entry: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download entry")


@router.delete(
    "/knowledge-base/entries/{entry_id}",
    response_model=Message,
    summary="Delete Knowledge Base Entry",
    operation_id="delete_kb_entry",
)
async def delete_entry(
    entry_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a knowledge base entry."""
    try:
        entry = kb_crud.get_entry_by_id(session, entry_id, current_user.id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        # Delete file from storage
        await storage_service.delete_file(entry.file_path)

        # Delete from database
        kb_crud.delete_entry(session, entry)

        logger.info(f"Deleted entry {entry_id}")
        return Message(message="Entry deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting entry: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete entry")


@router.put(
    "/knowledge-base/entries/{entry_id}/move",
    response_model=KnowledgeBaseEntryPublic,
    summary="Move Entry to Another Folder",
    operation_id="move_kb_entry",
)
async def move_entry(
    entry_id: uuid.UUID,
    move_data: FileMoveRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseEntryPublic:
    """Move a file to a different folder."""
    try:
        # Get entry
        entry = kb_crud.get_entry_by_id(session, entry_id, current_user.id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        # Check if already in target folder
        if entry.folder_id == move_data.target_folder_id:
            return KnowledgeBaseEntryPublic.model_validate(entry)

        # Verify target folder exists and belongs to user
        target_folder = kb_crud.get_folder_by_id(
            session, move_data.target_folder_id, current_user.id
        )
        if not target_folder:
            raise HTTPException(status_code=404, detail="Target folder not found")

        # Sanitize filename
        sanitized_filename = file_processor.sanitize_filename(entry.filename)

        # Move file in storage
        new_file_path = await storage_service.move_file(
            old_path=entry.file_path,
            new_path_parts=[str(move_data.target_folder_id), str(entry.id)],
            filename=sanitized_filename,
        )

        # Update database
        entry = kb_crud.move_entry(
            session, entry, move_data.target_folder_id, new_file_path
        )

        logger.info(f"Moved entry {entry_id} to folder {move_data.target_folder_id}")
        return KnowledgeBaseEntryPublic.model_validate(entry)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving entry: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to move entry")


# ==================== Agent Assignment Endpoints ====================


@router.get(
    "/knowledge-base/agents/{agent_id}/assignments",
    response_model=dict[uuid.UUID, bool],
    summary="Get Agent Knowledge Assignments",
    operation_id="get_agent_kb_assignments",
)
async def get_agent_assignments(
    agent_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[uuid.UUID, bool]:
    """Get knowledge base assignments for an agent."""
    try:
        # Verify agent ownership
        from sqlmodel import select

        from app.models import Agent

        agent = session.exec(select(Agent).where(Agent.id == agent_id)).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        if not current_user.is_superuser and agent.owner_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this agent"
            )

        assignments = kb_crud.get_agent_assignments(session, agent_id)
        return assignments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent assignments: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve agent assignments"
        )


@router.post(
    "/knowledge-base/agents/{agent_id}/assignments",
    response_model=Message,
    summary="Update Agent Knowledge Assignments",
    operation_id="update_agent_kb_assignments",
)
async def update_agent_assignments(
    agent_id: uuid.UUID,
    assignment_data: AgentKnowledgeAssignmentRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Update knowledge base assignments for an agent."""
    try:
        # Verify agent ownership
        from sqlmodel import select

        from app.models import Agent

        agent = session.exec(select(Agent).where(Agent.id == agent_id)).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        if not current_user.is_superuser and agent.owner_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to modify this agent"
            )

        # Clear existing assignments
        kb_crud.clear_agent_assignments(session, agent_id)

        # Create new assignments
        for entry_id in assignment_data.entry_ids:
            kb_crud.create_agent_assignment(
                session, agent_id, entry_id, current_user.id
            )

        logger.info(
            f"Updated {len(assignment_data.entry_ids)} assignments for agent {agent_id}"
        )
        return Message(message="Assignments updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent assignments: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update assignments")


# ==================== Statistics Endpoints ====================


@router.get(
    "/knowledge-base/stats",
    response_model=KnowledgeBaseStats,
    summary="Get Knowledge Base Statistics",
    operation_id="get_kb_stats",
)
async def get_knowledge_base_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeBaseStats:
    """Get knowledge base statistics for the current user."""
    try:
        folders = kb_crud.get_folders(session, current_user.id)
        total_size = kb_crud.get_total_file_size_for_user(session, current_user.id)

        # Count total entries
        total_entries = 0
        for folder in folders:
            total_entries += kb_crud.get_folder_entry_count(session, folder.id)

        return KnowledgeBaseStats(
            total_folders=len(folders),
            total_entries=total_entries,
            total_size_bytes=total_size,
            total_size_mb=round(total_size / (1024 * 1024), 2),
            active_entries=total_entries,
        )
    except Exception as e:
        logger.error(f"Error getting knowledge base stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")
