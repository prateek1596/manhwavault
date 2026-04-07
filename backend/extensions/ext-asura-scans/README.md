# ext-asura-scans

ManhwaVault extension for [Asura Scans](https://asuracomic.net).

## Install

In your ManhwaVault app → Extensions → Install, paste:

```
https://github.com/YOUR_USERNAME/ext-asura-scans
```

## Structure

Every ManhwaVault extension needs exactly two files:

### `extension.json`
```json
{
  "name": "Asura Scans",
  "version": "1.0.0",
  "base_url": "https://asuracomic.net",
  "language": "en",
  "nsfw": false,
  "entry": "scraper.py",
  "class": "AsuraScraper"
}
```

### `scraper.py`
Must subclass `BaseScraper` and implement:
- `search(query)` → `List[Manhwa]`
- `get_detail(manhwa_url)` → `Manhwa`
- `get_chapters(manhwa_url)` → `List[Chapter]`
- `get_images(chapter_url)` → `List[str]`

## Creating a new extension

1. Copy this repo
2. Rename to `ext-yoursite`
3. Update `extension.json`
4. Rewrite `scraper.py` with the new site's selectors
5. Push to GitHub
