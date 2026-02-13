from __future__ import annotations

import re
import unicodedata


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    # Strip Latin combining marks (accents) but keep Arabic combining marks
    # (harakat U+0610-U+065F) so diacritised MSA text is preserved when present.
    normalized = "".join(
        ch
        for ch in normalized
        if not unicodedata.combining(ch) or ("\u0610" <= ch <= "\u065f")
    )
    normalized = re.sub(r"[^\w\u0600-\u06FF\u4E00-\u9FFF]+", "", normalized)
    return normalized.strip()


def levenshtein_distance(a: str, b: str) -> int:
    if a == b:
        return 0

    rows = len(a) + 1
    cols = len(b) + 1
    dp = [[0] * cols for _ in range(rows)]

    for i in range(rows):
        dp[i][0] = i

    for j in range(cols):
        dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )

    return dp[-1][-1]


def similarity_score(a: str, b: str) -> float:
    if not a and not b:
        return 100.0

    denom = max(len(a), len(b), 1)
    distance = levenshtein_distance(a, b)
    return max(0.0, min(100.0, round((1 - distance / denom) * 100, 2)))
