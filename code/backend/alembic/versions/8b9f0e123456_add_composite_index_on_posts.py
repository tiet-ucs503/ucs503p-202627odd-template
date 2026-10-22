"""add composite index on posts

Revision ID: 8b9f0e123456
Revises: 7a8f9e012345
Create Date: 2026-09-13 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9f0e123456'
down_revision: Union[str, Sequence[str], None] = '7a8f9e012345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_posts_user_id_created_at',
        'posts',
        ['user_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_posts_user_id_created_at', table_name='posts')
