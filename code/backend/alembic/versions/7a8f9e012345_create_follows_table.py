"""create follows table

Revision ID: 7a8f9e012345
Revises: 2ee7f9b72596
Create Date: 2026-09-13 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8f9e012345'
down_revision: Union[str, Sequence[str], None] = '2ee7f9b72596'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'follows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('follower_id', sa.Integer(), nullable=False),
        sa.Column('followed_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('follower_id != followed_id', name='ck_no_self_follow'),
        sa.ForeignKeyConstraint(['followed_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('follower_id', 'followed_id', name='uq_follower_followed')
    )
    op.create_index(op.f('ix_follows_followed_id'), 'follows', ['followed_id'], unique=False)
    op.create_index(op.f('ix_follows_follower_id'), 'follows', ['follower_id'], unique=False)
    op.create_index(op.f('ix_follows_id'), 'follows', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_follows_id'), table_name='follows')
    op.drop_index(op.f('ix_follows_follower_id'), table_name='follows')
    op.drop_index(op.f('ix_follows_followed_id'), table_name='follows')
    op.drop_table('follows')
