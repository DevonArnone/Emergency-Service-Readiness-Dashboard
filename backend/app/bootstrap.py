"""Explicit migration/seed job; never runs inside the least-privilege API process."""
from alembic import command
from alembic.config import Config


def main() -> None:
    command.upgrade(Config('alembic.ini'), 'head')
    from app.stores import personnel_store, units_store
    from app.services.demo_service import seed_demo
    if not personnel_store and not units_store:
        seed_demo()


if __name__ == '__main__':
    main()
