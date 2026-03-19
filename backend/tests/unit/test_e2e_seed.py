from pathlib import Path

from scripts.e2e_seed import _reset_snapshot_dir


def test_reset_snapshot_dir_keeps_root_directory_but_removes_children(tmp_path):
    snapshot_dir = tmp_path / "snapshots"
    nested_dir = snapshot_dir / "nested"
    nested_dir.mkdir(parents=True)
    (snapshot_dir / "changeset.json").write_text("{}", encoding="utf-8")
    (nested_dir / "orphan.txt").write_text("stale", encoding="utf-8")

    _reset_snapshot_dir(snapshot_dir)

    assert snapshot_dir.exists()
    assert snapshot_dir.is_dir()
    assert list(snapshot_dir.iterdir()) == []
