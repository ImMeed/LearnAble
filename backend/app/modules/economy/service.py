from uuid import UUID

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.db.models.economy import PointTransaction, PointTransactionType, PointsWallet, XpLedger


def _get_or_create_wallet(session: Session, user_id: UUID) -> PointsWallet:
    wallet_stmt = select(PointsWallet).where(PointsWallet.user_id == user_id).with_for_update()
    wallet = session.scalar(wallet_stmt)
    if wallet is None:
        wallet = PointsWallet(user_id=user_id, balance_points=0)
        session.add(wallet)
        session.flush()
    return wallet


def apply_points_transaction(
    session: Session,
    user_id: UUID,
    transaction_type: PointTransactionType,
    points_delta: int,
    reason: str,
    metadata: dict,
) -> int:
    wallet = _get_or_create_wallet(session, user_id)
    wallet.balance_points = wallet.balance_points + points_delta

    session.add(
        PointTransaction(
            user_id=user_id,
            type=transaction_type,
            points_delta=points_delta,
            reason=reason,
            metadata_json=metadata,
        )
    )

    return wallet.balance_points


def apply_quiz_reward(
    session: Session,
    user_id: UUID,
    points_delta: int,
    xp_delta: int,
    reason: str,
    metadata: dict,
) -> int:
    wallet_balance = apply_points_transaction(
        session=session,
        user_id=user_id,
        transaction_type=PointTransactionType.QUIZ_EARN,
        points_delta=points_delta,
        reason=reason,
        metadata=metadata,
    )
    session.add(
        XpLedger(
            user_id=user_id,
            xp_delta=xp_delta,
            reason=reason,
            metadata_json=metadata,
        )
    )

    # Session autoflush is disabled, so force pending writes before progression reads aggregate XP.
    session.flush()

    return wallet_balance


def apply_hint_penalty(
    session: Session,
    user_id: UUID,
    points_cost: int,
    reason: str,
    metadata: dict,
    locale: str,
) -> int:
    wallet = _get_or_create_wallet(session, user_id)
    if wallet.balance_points < points_cost:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "INSUFFICIENT_POINTS", locale)

    return apply_points_transaction(
        session=session,
        user_id=user_id,
        transaction_type=PointTransactionType.HINT_PENALTY,
        points_delta=-points_cost,
        reason=reason,
        metadata=metadata,
    )
