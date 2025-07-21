"""add_multi_source_chat_type

Revision ID: multi_source_001
Revises: 8db75112370e
Create Date: 2025-07-21 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'multi_source_001'
down_revision = '8db75112370e'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add the new enum value to the existing enum type
    op.execute("ALTER TYPE featuretypeenum ADD VALUE 'multi_source'")

def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the enum type, which is complex
    # For now, we'll leave this as a no-op
    pass
