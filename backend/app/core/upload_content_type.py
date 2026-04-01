import mimetypes
from typing import Optional

# Ensure common types are registered (helps on some platforms)
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")


def resolve_stored_image_content_type(
    *,
    filename: Optional[str],
    declared: Optional[str],
    fallback: str = "application/octet-stream",
) -> str:
    """
    Never return None. Prefer the client-declared MIME when present; otherwise
    guess from filename (e.g. .mp4 -> video/mp4). Used for StoredImage rows
    where content_type is NOT NULL.
    """
    if declared is not None:
        s = str(declared).strip()
        if s and s.lower() != "none":
            return s
    if filename:
        guessed, _ = mimetypes.guess_type(filename)
        if not guessed:
            guessed, _ = mimetypes.guess_type(filename.lower())
        if guessed:
            return guessed
    return fallback
