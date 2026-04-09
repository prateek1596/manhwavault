import json
import shutil
import importlib.util
import logging
from pathlib import Path
from typing import Dict
from urllib.parse import quote

import git

from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)
EXTENSIONS_DIR = Path(__file__).parent.parent / "extensions"
EXTENSIONS_DIR.mkdir(exist_ok=True)

# Create __init__.py so extensions dir is a package
init = EXTENSIONS_DIR / "__init__.py"
if not init.exists():
    init.write_text("")


class ExtensionManager:

    @staticmethod
    def _default_icon_for_base_url(base_url: str) -> str:
        if not base_url:
            return ""
        return f"https://www.google.com/s2/favicons?sz=128&domain_url={quote(base_url, safe=':/')}"

    def install(self, git_url: str) -> str:
        name = git_url.rstrip("/").split("/")[-1]
        dest = EXTENSIONS_DIR / name
        if dest.exists():
            raise ValueError(f"Extension '{name}' is already installed. Use update instead.")
        git.Repo.clone_from(git_url, dest)
        logger.info(f"Installed extension: {name}")
        return name

    def update(self, name: str) -> str:
        dest = EXTENSIONS_DIR / name
        if not dest.exists():
            raise ValueError(f"Extension '{name}' is not installed.")
        repo = git.Repo(dest)
        repo.remotes.origin.pull()
        logger.info(f"Updated extension: {name}")
        return name

    def remove(self, name: str) -> str:
        dest = EXTENSIONS_DIR / name
        if not dest.exists():
            raise ValueError(f"Extension '{name}' is not installed.")
        shutil.rmtree(dest)
        logger.info(f"Removed extension: {name}")
        return name

    def check_updates(self) -> list[dict]:
        results = []
        for ext_dir in EXTENSIONS_DIR.iterdir():
            if not ext_dir.is_dir() or not (ext_dir / ".git").exists():
                continue
            try:
                repo = git.Repo(ext_dir)
                repo.remotes.origin.fetch()
                local = repo.head.commit.hexsha
                remote = repo.remotes.origin.refs[0].commit.hexsha
                manifest = self._read_manifest(ext_dir)
                results.append({
                    "name": manifest.get("name", ext_dir.name),
                    "hasUpdate": local != remote,
                })
            except Exception as e:
                logger.warning(f"Could not check updates for {ext_dir.name}: {e}")
        return results

    def load_all(self) -> Dict[str, BaseScraper]:
        scrapers: Dict[str, BaseScraper] = {}
        for ext_dir in EXTENSIONS_DIR.iterdir():
            if not ext_dir.is_dir() or ext_dir.name.startswith("_"):
                continue
            manifest_path = ext_dir / "extension.json"
            if not manifest_path.exists():
                continue
            try:
                manifest = self._read_manifest(ext_dir)
                scraper = self._load_class(ext_dir, manifest)
                scrapers[scraper.name] = scraper
                logger.info(f"Loaded extension: {scraper.name}")
            except Exception as e:
                logger.error(f"Failed to load extension {ext_dir.name}: {e}")
        return scrapers

    def list_installed(self) -> list[dict]:
        result = []
        for ext_dir in EXTENSIONS_DIR.iterdir():
            if not ext_dir.is_dir() or ext_dir.name.startswith("_"):
                continue
            manifest_path = ext_dir / "extension.json"
            if not manifest_path.exists():
                continue
            try:
                m = self._read_manifest(ext_dir)
                base_url = m.get("base_url", "")
                result.append({
                    "name": m.get("name", ext_dir.name),
                    "version": m.get("version", "?"),
                    "baseUrl": base_url,
                    "language": m.get("language", "en"),
                    "nsfw": m.get("nsfw", False),
                    "iconUrl": m.get("icon_url", "") or self._default_icon_for_base_url(base_url),
                    "repoUrl": self._get_repo_url(ext_dir),
                    "installed": True,
                })
            except Exception as e:
                logger.warning(f"Could not read manifest for {ext_dir.name}: {e}")
        return result

    def _read_manifest(self, ext_dir: Path) -> dict:
        return json.loads((ext_dir / "extension.json").read_text())

    def _get_repo_url(self, ext_dir: Path) -> str:
        try:
            repo = git.Repo(ext_dir)
            return repo.remotes.origin.url
        except Exception:
            return ""

    def _load_class(self, ext_dir: Path, manifest: dict) -> BaseScraper:
        entry = ext_dir / manifest["entry"]
        spec = importlib.util.spec_from_file_location(manifest["class"], entry)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cls = getattr(module, manifest["class"])
        return cls()
