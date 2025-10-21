"""Generic pagination system for FastAPI with SQLModel."""

from math import ceil
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select
from sqlmodel import SQLModel

T = TypeVar("T", bound=SQLModel)


class PaginationMeta(BaseModel):
    """Pagination metadata."""

    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def create(cls, page: int, limit: int, total: int) -> "PaginationMeta":
        pages = ceil(total / limit) if total > 0 else 0
        return cls(
            page=page,
            limit=limit,
            total=total,
            pages=pages,
            has_next=page < pages,
            has_prev=page > 1,
        )


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic response that can include optional pagination metadata."""

    data: list[T]
    pagination: PaginationMeta | None = None


class PaginationQueryParams(BaseModel):
    """Query parameters for pagination."""

    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=1000)
    disable: bool = Field(
        default=False, description="Disable pagination and return all results"
    )

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


def get_pagination_params(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=1000),
    disable: bool = Query(
        False, description="Disable pagination and return all results"
    ),
) -> PaginationQueryParams:
    return PaginationQueryParams(page=page, limit=limit, disable=disable)


def paginate_query(
    session, query: Select, count_query: Select, pagination: PaginationQueryParams
):
    """Execute paginated query and return results with total count."""
    if pagination.disable:
        # Return all results without pagination
        results = session.exec(query).all()
        return results, len(results)

    # Normal pagination
    total = session.exec(count_query).one()
    results = session.exec(
        query.offset(pagination.offset).limit(pagination.limit)
    ).all()
    return results, total


def create_paginated_response(
    data: list[T], pagination: PaginationQueryParams, total: int
) -> PaginatedResponse[T]:
    """Create response with optional pagination metadata."""
    if pagination.disable:
        return PaginatedResponse(data=data, pagination=None)

    meta = PaginationMeta.create(pagination.page, pagination.limit, total)
    return PaginatedResponse(data=data, pagination=meta)


class Message(SQLModel):
    """Generic message response."""

    message: str
