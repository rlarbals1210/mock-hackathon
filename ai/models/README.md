# 매칭 API 모델 번들

이 폴더의 모델은 `ai/generate_data.py`가 seed 2026으로 생성한 v13 가상 데이터와 `ai/notebooks/phase5_제안모델.ipynb`으로 2026-08-12에 다시 학습했다.

## 번들

- `model_A_수락예측.joblib`: 제안 수락확률 분류기. 8,924개 제안, 전체 교차검증 AUC 0.679.
- `model_B_반사실예측.joblib`: 유찰 분류기와 체결운임 점·구간 회귀기. 유찰 CV AUC 0.742, 운임 CV R² 0.372, 반사실 검증 MAPE 8.85%.

두 번들에는 추론 시 학습과 동일한 범주 코드를 재현할 수 있도록 범주 순서(`category_levels*`)를 함께 저장한다. 백엔드는 이 메타데이터가 없으면 잘못된 범주 인코딩을 피하기 위해 추론을 중단하고 확률을 `null`로 반환한다.

## 재현성 확인

```text
model_A_수락예측.joblib  sha256 76c04fd0927484ae239f40360abf52ad3754012312c7afe99cb08cb04f9b218b
model_B_반사실예측.joblib sha256 b97f486b3a6ed3f9999c5ae7f53876e8022e6b04d7ee2aee5b78afda44353b4c
```

이 성능은 실제 거래가 아니라 가상 데이터에서 측정한 값이다. 실제 서비스 정확도로 표현하지 않는다.
