from uuid import UUID

from pydantic import BaseModel


class BookSummary(BaseModel):
    id: UUID
    title: str
    author: str
    summary: str
    cover_image_url: str | None
    points_cost: int
    owned: bool


class BookListResponse(BaseModel):
    items: list[BookSummary] = []


class BookDetailResponse(BaseModel):
    id: UUID
    title: str
    author: str
    summary: str
    cover_image_url: str | None
    reader_url: str
    points_cost: int
    owned: bool


class RedeemBookResponse(BaseModel):
    book_id: UUID
    points_spent: int
    wallet_balance: int
    already_owned: bool


class ReadBookResponse(BaseModel):
    book_id: UUID
    title: str
    reader_url: str
