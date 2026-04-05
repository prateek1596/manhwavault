import os
import sys
import pkgutil
import importlib
from pathlib import Path
from typing import Dict, Type
from git import Repo
import logging
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class ExtensionManager:
    """Manages discovery, loading, and installation of scraper extensions"""

    def __init__(self, extensions_dir: str):
        self.extensions_dir = extensions_dir
        self.scrapers: Dict[str, BaseScraper] = {}
        self.installed_extensions: Dict[str, dict] = {}

    def load_all(self) -> Dict[str, BaseScraper]:
        """
        Dynamically discover and load all extensions from extensions directory

        Returns:
            Dictionary of {source_id: scraper_instance}
        """
        self.scrapers.clear()
        
        # Add extensions directory to path if not already there
        if self.extensions_dir not in sys.path:
            sys.path.insert(0, self.extensions_dir)

        # Discover all extension modules
        extension_path = Path(self.extensions_dir)
        
        for importer, modname, ispkg in pkgutil.iter_modules(
            [str(extension_path)], prefix=""
        ):
            if modname.startswith("_") or modname == "base_scraper":
                continue

            try:
                module = importlib.import_module(modname)
                
                # Find all BaseScraper subclasses in the module
                for item_name in dir(module):
                    item = getattr(module, item_name)
                    
                    # Check if it's a class and subclass of BaseScraper (but not BaseScraper itself)
                    if (
                        isinstance(item, type)
                        and issubclass(item, BaseScraper)
                        and item is not BaseScraper
                    ):
                        try:
                            instance = item()
                            self.scrapers[instance.source_id] = instance
                            logger.info(
                                f"Loaded extension: {instance.name} "
                                f"({instance.source_id} v{instance.version})"
                            )
                        except Exception as e:
                            logger.error(f"Failed to instantiate {item_name}: {e}")
            
            except Exception as e:
                logger.error(f"Failed to load extension module {modname}: {e}")

        return self.scrapers

    def get_scraper(self, source_id: str) -> BaseScraper | None:
        """Get a specific scraper by source_id"""
        return self.scrapers.get(source_id)

    def list_scrapers(self) -> Dict[str, dict]:
        """
        Get metadata for all loaded scrapers

        Returns:
            Dictionary of scraper metadata
        """
        return {
            source_id: {
                "name": scraper.name,
                "source_id": scraper.source_id,
                "version": scraper.version,
                "language": scraper.language,
            }
            for source_id, scraper in self.scrapers.items()
        }

    async def install_extension(self, git_url: str, extension_name: str) -> bool:
        """
        Install an extension from a git repository

        Args:
            git_url: URL of the git repository
            extension_name: Name of the extension

        Returns:
            True if installation successful, False otherwise
        """
        try:
            extension_path = os.path.join(
                self.extensions_dir, 
                extension_name
            )
            
            # Clone the repository
            Repo.clone_from(git_url, extension_path)
            
            logger.info(f"Successfully installed extension: {extension_name}")
            
            # Reload all extensions
            self.load_all()
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to install extension {extension_name}: {e}")
            return False

    async def update_extension(self, extension_name: str) -> bool:
        """
        Update an installed extension from its git repository

        Args:
            extension_name: Name of the extension to update

        Returns:
            True if update successful, False otherwise
        """
        try:
            extension_path = os.path.join(
                self.extensions_dir, 
                extension_name
            )
            
            if not os.path.exists(extension_path):
                logger.error(f"Extension not found: {extension_name}")
                return False
            
            repo = Repo(extension_path)
            repo.remotes.origin.pull()
            
            logger.info(f"Successfully updated extension: {extension_name}")
            
            # Reload all extensions
            self.load_all()
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to update extension {extension_name}: {e}")
            return False

    async def uninstall_extension(self, extension_name: str) -> bool:
        """
        Uninstall an extension

        Args:
            extension_name: Name of the extension to uninstall

        Returns:
            True if uninstall successful, False otherwise
        """
        try:
            import shutil
            
            extension_path = os.path.join(
                self.extensions_dir, 
                extension_name
            )
            
            if os.path.exists(extension_path):
                shutil.rmtree(extension_path)
                logger.info(f"Successfully uninstalled extension: {extension_name}")
                
                # Reload all extensions
                self.load_all()
                
                return True
            
            return False
        
        except Exception as e:
            logger.error(f"Failed to uninstall extension {extension_name}: {e}")
            return False

    async def check_updates(self) -> Dict[str, dict]:
        """
        Check for available updates for all installed extensions

        Returns:
            Dictionary of {extension_name: {local_commit, remote_commit}}
        """
        updates = {}
        
        # List all directories in extensions_dir
        for ext_dir in os.listdir(self.extensions_dir):
            ext_path = os.path.join(self.extensions_dir, ext_dir)
            
            if not os.path.isdir(ext_path) or ext_dir.startswith("_"):
                continue
            
            try:
                repo = Repo(ext_path)
                
                local_commit = repo.head.commit.hexsha[:7]
                repo.remotes.origin.fetch()
                remote_commit = repo.refs.origin.HEAD.commit.hexsha[:7]
                
                if local_commit != remote_commit:
                    updates[ext_dir] = {
                        "local": local_commit,
                        "remote": remote_commit,
                        "update_available": True
                    }
            
            except Exception as e:
                logger.error(f"Failed to check updates for {ext_dir}: {e}")
        
        return updates
