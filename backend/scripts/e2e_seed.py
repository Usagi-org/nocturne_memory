import argparse
import asyncio
import os
import shutil
import sys
from pathlib import Path

from sqlalchemy import text


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
REPO_ROOT = BACKEND_ROOT.parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


VALID_DOMAINS = "core,writer,game,notes,project"
CORE_MEMORY_URIS = "core://agent,core://my_user"


def _resolve_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for E2E seeding")
    return database_url


async def _reset_sqlite_state(database_url: str):
    from db.database import DatabaseManager

    manager = DatabaseManager(database_url)
    async with manager.engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))

        result = await conn.execute(
            text(
                """
                SELECT type, name
                FROM sqlite_master
                WHERE name NOT LIKE 'sqlite_%'
                  AND type IN ('view', 'table')
                ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name
                """
            )
        )
        objects = result.fetchall()
        for object_type, name in objects:
            escaped_name = name.replace('"', '""')
            await conn.execute(text(f'DROP {object_type.upper()} IF EXISTS "{escaped_name}"'))

        await conn.execute(text("PRAGMA foreign_keys=ON"))

    await manager.close()


async def _reset_postgresql_state(database_url: str):
    from db.database import DatabaseManager

    manager = DatabaseManager(database_url)
    async with manager.engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await manager.close()


async def _reset_state(database_url: str, snapshot_dir: Path):
    from db import close_db

    await close_db()

    if snapshot_dir.exists():
        shutil.rmtree(snapshot_dir)
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    if database_url.startswith("sqlite"):
        sqlite_path = Path(database_url.split("///", 1)[1])
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        if sqlite_path.exists():
            await _reset_sqlite_state(database_url)
    elif database_url.startswith("postgresql"):
        await _reset_postgresql_state(database_url)

    await close_db()


async def _seed_full():
    from db import close_db, get_db_manager, get_glossary_service, get_graph_service
    import db.snapshot as snapshot_module
    import mcp_server

    database_url = _resolve_database_url()
    snapshot_dir = Path(os.environ["SNAPSHOT_DIR"])

    os.environ["VALID_DOMAINS"] = VALID_DOMAINS
    os.environ["CORE_MEMORY_URIS"] = CORE_MEMORY_URIS

    await _reset_state(database_url, snapshot_dir)

    snapshot_module._store = snapshot_module.ChangesetStore(snapshot_dir=str(snapshot_dir))
    mcp_server.VALID_DOMAINS = ["core", "writer", "game", "notes", "project", "system"]
    mcp_server.CORE_MEMORY_URIS = ["core://agent", "core://my_user"]

    db_manager = get_db_manager()
    await db_manager.init_db()

    graph = get_graph_service()
    glossary = get_glossary_service()

    await graph.create_memory(
        parent_path="",
        content="Agent identity",
        priority=1,
        title="agent",
        disclosure="When booting",
    )
    await graph.create_memory(
        parent_path="",
        content="User identity",
        priority=1,
        title="my_user",
        disclosure="When booting",
    )

    workspace = await graph.create_memory(
        parent_path="",
        content="Workspace note mentions Salem.",
        priority=2,
        title="workspace",
        disclosure="When browsing workspace",
    )
    await graph.create_memory(
        parent_path="workspace",
        content="Nested child note",
        priority=3,
        title="child",
        disclosure="When browsing nested children",
    )
    await graph.add_path(
        new_path="mirror_workspace",
        target_path="workspace",
        new_domain="project",
        target_domain="core",
        priority=3,
        disclosure="When mirroring workspace",
    )

    glossary_target = await graph.create_memory(
        parent_path="",
        content="Salem target memory",
        priority=2,
        title="glossary_target",
        disclosure="When following glossary links",
    )
    await glossary.add_glossary_keyword("Salem", glossary_target["node_uuid"])

    await graph.create_memory(
        parent_path="",
        content="Original review content",
        priority=2,
        title="review_item",
        disclosure="When reviewing",
    )
    await mcp_server.update_memory("core://review_item", append="\nPending review update")

    await graph.create_memory(
        parent_path="",
        content="Will become orphaned",
        priority=2,
        title="orphan_leaf",
        disclosure="When testing maintenance",
    )
    await graph.remove_path("orphan_leaf", "core")

    await close_db()


async def main():
    parser = argparse.ArgumentParser(description="Seed deterministic E2E data.")
    parser.add_argument("--scenario", default="full", choices=["full"])
    args = parser.parse_args()

    if args.scenario == "full":
        await _seed_full()


if __name__ == "__main__":
    asyncio.run(main())
