from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import isfinite
from pathlib import Path
from threading import RLock
from typing import Any


@dataclass(frozen=True)
class ScenarioModelResult:
    fare_point: int | None = None
    fare_min: int | None = None
    fare_max: int | None = None
    failure_probability: float | None = None


class MatchingModelService:
    """Loads production model bundles lazily.

    A bundle without category_levels is rejected. The original notebook artifacts did
    not preserve category encodings, and silently recreating them can produce incorrect
    predictions even when column names match.
    """

    def __init__(self, model_dir: Path) -> None:
        self.model_dir = model_dir
        self._lock = RLock()
        self._model_a: dict[str, Any] | None = None
        self._model_b: dict[str, Any] | None = None
        self._loaded = False
        self._warnings: list[str] = []

    @property
    def warnings(self) -> list[str]:
        self._load()
        return list(self._warnings)

    @property
    def has_model_a(self) -> bool:
        self._load()
        return self._model_a is not None

    @property
    def has_model_b(self) -> bool:
        self._load()
        return self._model_b is not None

    def _load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            self._loaded = True
            try:
                import joblib
            except ImportError:
                self._warnings.append("joblib이 없어 학습 모델을 불러오지 못했습니다.")
                return

            paths = {
                "A": self.model_dir / "model_A_수락예측.joblib",
                "B": self.model_dir / "model_B_반사실예측.joblib",
            }
            for kind, path in paths.items():
                if not path.exists():
                    self._warnings.append(f"모델 {kind} 파일이 없어 관련 확률을 제공하지 않습니다.")
                    continue
                try:
                    bundle = joblib.load(path)
                except Exception as exc:  # model compatibility errors must not break all matching
                    self._warnings.append(f"모델 {kind} 파일을 읽지 못했습니다: {exc.__class__.__name__}")
                    continue
                levels_ready = (
                    isinstance(bundle, dict)
                    and (
                        bool(bundle.get("category_levels"))
                        if kind == "A"
                        else bool(bundle.get("category_levels_유찰")) and bool(bundle.get("category_levels_운임"))
                    )
                )
                if not levels_ready:
                    self._warnings.append(
                        f"모델 {kind}에 category_levels가 없어 안전한 추론을 중단했습니다. 모델을 다시 내보내세요."
                    )
                    continue
                if kind == "A":
                    self._model_a = bundle
                else:
                    self._model_b = bundle

    @staticmethod
    def _categorize(frame: Any, levels: dict[str, list[Any]]) -> Any:
        import pandas as pd

        for column, categories in levels.items():
            if column not in frame.columns:
                continue
            value = frame.iloc[0][column]
            if value not in categories:
                raise ValueError(f"학습 범주에 없는 값입니다: {column}={value}")
            frame[column] = pd.Categorical(frame[column], categories=categories)
        return frame

    def predict_scenario(self, context: dict[str, Any]) -> ScenarioModelResult:
        self._load()
        if self._model_b is None:
            return ScenarioModelResult()
        try:
            import numpy as np
            import pandas as pd

            bundle = self._model_b
            loading_at: datetime = context["loading_at"]
            registered_at = loading_at - timedelta(hours=float(context["lead_time_hours"]))
            row = {
                "시간창_분": context["loading_window_minutes"],
                "리드타임_h": context["lead_time_hours"],
                "거리km": context["distance_km"],
                "톤급": context["tonnage"],
                "중량_kg": context["weight_kg"],
                "파렛트": context["pallets"],
                "적재율": context["weight_kg"] / (context["tonnage"] * 1000),
                "긴급플래그": int(context["urgent"]),
                "권한_미승인": int(context["permission_unapproved"]),
                "flex_cargo": context["flex_cargo"],
                "flex_veh": int(context["vehicle_flexible"]),
                "기준운임": context["base_fare_krw"],
                "수락가능_현조건": context["candidate_count"],
                "수락가능_시간완화": context["candidate_count_48h"],
                "발주건수": context["shipper_order_count"],
                "요일집중도": context["weekday_concentration"],
                "노선_집중도": context["route_concentration"],
                "시간대": registered_at.hour,
                "주말상차": int(loading_at.weekday() >= 5),
                "log_시간창": np.log1p(context["loading_window_minutes"]),
                "log_리드타임": np.log(max(context["lead_time_hours"], 1)),
                "적재형태": context["body_type"],
                "세그먼트_규칙": context["shipper_segment"],
                "등록주체": context["registration_actor"],
                "노선ID": context["route_id"],
                "요일": registered_at.weekday(),
            }
            xf = pd.DataFrame([row])[bundle["features_유찰"]].copy()
            xf = self._categorize(xf, bundle["category_levels_유찰"])
            failure_probability = float(bundle["유찰모델"].predict_proba(xf)[0, 1])

            xb = xf.copy()
            xb["유찰확률"] = failure_probability
            xb = xb[bundle["features_운임"]]
            xb = self._categorize(xb, bundle["category_levels_운임"])
            point_ratio = float(np.exp(bundle["운임모델"].predict(xb)[0]))
            min_ratio = float(np.exp(bundle["운임모델_하한"].predict(xb)[0]))
            max_ratio = float(np.exp(bundle["운임모델_상한"].predict(xb)[0]))
            if (
                not all(isfinite(value) and value > 0 for value in (point_ratio, min_ratio, max_ratio))
                or not isfinite(failure_probability)
                or not 0 <= failure_probability <= 1
            ):
                raise ValueError("모델 B가 유효하지 않은 숫자를 반환했습니다.")
            fare_point = int(round(point_ratio * context["base_fare_krw"]))
            fare_min = min(
                fare_point,
                int(round(min_ratio * context["base_fare_krw"])),
                int(round(max_ratio * context["base_fare_krw"])),
            )
            fare_max = max(
                fare_point,
                int(round(min_ratio * context["base_fare_krw"])),
                int(round(max_ratio * context["base_fare_krw"])),
            )
            return ScenarioModelResult(
                fare_point=fare_point,
                fare_min=fare_min,
                fare_max=fare_max,
                failure_probability=max(0.0, min(1.0, failure_probability)),
            )
        except Exception as exc:
            warning = f"모델 B 추론을 건너뛰었습니다: {exc.__class__.__name__}"
            if warning not in self._warnings:
                self._warnings.append(warning)
            return ScenarioModelResult()

    def predict_shipper_acceptance(self, context: dict[str, Any]) -> float | None:
        self._load()
        if self._model_a is None:
            return None
        try:
            import numpy as np
            import pandas as pd

            bundle = self._model_a
            current_candidates = max(int(context["current_candidate_count"]), 1)
            baseline_dispatch = 266 / current_candidates ** 0.354
            row = {
                "시간창_분": context["current_window_minutes"],
                "리드타임_h": context["lead_time_hours"],
                "거리km": context["distance_km"],
                "톤급": context["tonnage"],
                "중량_kg": context["weight_kg"],
                "파렛트": context["pallets"],
                "적재율": context["weight_kg"] / (context["tonnage"] * 1000),
                "긴급플래그": int(context["urgent"]),
                "권한_미승인": int(context["permission_unapproved"]),
                "flex_cargo": context["flex_cargo"],
                "flex_veh": int(context["vehicle_flexible"]),
                "기준운임": context["base_fare_krw"],
                "제시운임": context["offered_fare_krw"],
                "수락가능_현조건": context["current_candidate_count"],
                "수락가능_시간완화": context["candidate_count_48h"],
                "시간변경비용_원_시간": context["time_change_cost_per_hour"],
                "발주건수": context["shipper_order_count"],
                "요일집중도": context["weekday_concentration"],
                "노선_집중도": context["route_concentration"],
                "예측_수락가능": context["proposed_candidate_count"],
                "예측_운임": context["proposed_fare_krw"],
                "예측_배차분": context["proposed_dispatch_minutes"],
                "신뢰도": 0.76,
                "제안순위": 1,
                "화주_과거수락률": context["shipper_acceptance_rate"],
                "log_시간창": np.log1p(context["current_window_minutes"]),
                "후보배율": context["candidate_count_48h"] / current_candidates,
                "운임변화율": context["proposed_fare_krw"] / context["offered_fare_krw"] - 1,
                "배차단축율": 1 - context["proposed_dispatch_minutes"] / baseline_dispatch,
                "적재형태": context["body_type"],
                "세그먼트_규칙": context["shipper_segment"],
                "등록주체": context["registration_actor"],
                "상차방법": context["loading_method"],
                "지불방식": context["payment_method"],
                "제안유형": "시간",
            }
            frame = pd.DataFrame([row])[bundle["features"]].copy()
            frame = self._categorize(frame, bundle["category_levels"])
            probability = float(bundle["model"].predict_proba(frame)[0, 1])
            if not isfinite(probability):
                raise ValueError("모델 A가 유효하지 않은 확률을 반환했습니다.")
            return max(0.0, min(1.0, probability))
        except Exception as exc:
            warning = f"모델 A 추론을 건너뛰었습니다: {exc.__class__.__name__}"
            if warning not in self._warnings:
                self._warnings.append(warning)
            return None
