from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock

from app.schemas.matching import FeedbackRequest, FeedbackResponse


KST = timezone(timedelta(hours=9))


class FeedbackStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = RLock()
        self._seen: dict[str, tuple[str, datetime]] | None = None

    @staticmethod
    def _key(request: FeedbackRequest) -> str:
        values = (
            request.matchId,
            request.actorId,
            request.action,
            request.callId or "",
            request.scenarioId or "",
        )
        return "\x1f".join(values)

    def _load(self) -> dict[str, tuple[str, datetime]]:
        if self._seen is not None:
            return self._seen
        self._seen = {}
        if not self.path.exists():
            return self._seen
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                self._seen[row["deduplicationKey"]] = (
                    row["feedbackId"], datetime.fromisoformat(row["recordedAt"])
                )
            except (KeyError, ValueError, json.JSONDecodeError):
                continue
        return self._seen

    def record(self, request: FeedbackRequest) -> FeedbackResponse:
        with self._lock:
            seen = self._load()
            key = self._key(request)
            if key in seen:
                feedback_id, recorded_at = seen[key]
                return FeedbackResponse(feedbackId=feedback_id, status="duplicate", recordedAt=recorded_at)

            now = datetime.now(KST)
            feedback_id = f"F-{now:%Y%m%d}-{len(seen) + 1:06d}"
            row = {
                "feedbackId": feedback_id,
                "recordedAt": now.isoformat(),
                "deduplicationKey": key,
                **request.model_dump(mode="json"),
            }
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            seen[key] = (feedback_id, now)
            return FeedbackResponse(feedbackId=feedback_id, status="recorded", recordedAt=now)
