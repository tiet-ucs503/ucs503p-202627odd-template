from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.post import Post


def get_feed(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> dict:
    followed_tuples = (
        db.query(Follow.followed_id)
        .filter(Follow.follower_id == user_id)
        .all()
    )
    followed_ids = [row[0] for row in followed_tuples]

    if not followed_ids:
        return {"items": [], "total": 0}

    query = db.query(Post).filter(
        Post.user_id.in_(followed_ids),
        Post.user_id != user_id
    )

    total = query.count()
    items = query.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()

    return {"items": items, "total": total}
