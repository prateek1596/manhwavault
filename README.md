## Contributing

Contributions are welcome.

### Backend Extensions

Extensions live in `backend/extensions/*` and must include:

- `extension.json`
- A scraper entry module (for example, `scraper.py`)

When creating a new extension:

1. Follow the existing extension structure.
2. Ensure all required metadata is present in `extension.json`.
3. Implement consistent error handling and fallback behavior.
4. Verify the extension loads successfully through the `/health` endpoint.
5. Add or update tests when applicable.

### Development Guidelines

- Format and lint code before submitting changes.
- Keep API responses consistent with existing schemas.
- Avoid breaking changes to public endpoints without discussion.
- Test both backend and mobile flows when modifying shared functionality.

### Running Tests

```powershell
cd backend
pytest -q
