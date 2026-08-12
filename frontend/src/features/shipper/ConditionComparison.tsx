import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  cargoIsComplete,
  formatCurrency,
  formatDate,
  formatTimeWindow,
  getCarbonReference,
  getWindowHours,
  interpolatePrediction,
  sourceRouteCarbon,
  type CargoForm,
  type DecisionChoice,
  type Prediction,
} from './shipperModel'

type ConditionComparisonProps = {
  cargo: CargoForm
  choice: DecisionChoice
  onChoose: (choice: Exclude<DecisionChoice, null>, adjustedHours: number) => void
  onOpenRegistration: () => void
}

function PredictionFacts({ prediction }: { prediction: Prediction }) {
  return (
    <dl className="prediction-facts">
      <div><dt>예상 수락 가능 차주</dt><dd>{prediction.candidates.toLocaleString('ko-KR')}명</dd></div>
      <div><dt>예상 운임</dt><dd>{formatCurrency(prediction.fare)}</dd></div>
      <div><dt>예상 배차 시간</dt><dd>{prediction.dispatchMinutes}분</dd></div>
      <div><dt>유찰 확률</dt><dd className="is-unavailable">원본 근거 없음</dd></div>
      <div><dt>상차 시간창</dt><dd>{prediction.windowHours}시간</dd></div>
    </dl>
  )
}

function Delta({ value, label }: { value: string; label: string }) {
  return <span className="comparison-delta"><small>{label}</small><strong>{value}</strong><Icon name="chevron" size={16} /></span>
}

export function ConditionComparison({ cargo, choice, onChoose, onOpenRegistration }: ConditionComparisonProps) {
  const currentHours = getWindowHours(cargo.startMinutes, cargo.endMinutes)
  const initialAdjusted = Math.min(48, Math.max(12, Math.ceil((currentHours ?? 3) + 9)))
  const [adjustedHours, setAdjustedHours] = useState(initialAdjusted)
  const [dialogChoice, setDialogChoice] = useState<Exclude<DecisionChoice, null> | null>(null)
  const complete = cargoIsComplete(cargo)

  useEffect(() => {
    setAdjustedHours(Math.min(48, Math.max(12, Math.ceil((currentHours ?? 3) + 9))))
  }, [currentHours])

  const currentPrediction = useMemo(() => interpolatePrediction(currentHours ?? 3), [currentHours])
  const adjustedPrediction = useMemo(() => interpolatePrediction(adjustedHours), [adjustedHours])
  const carbon = getCarbonReference(cargo)
  const routeKey = `${cargo.origin}→${cargo.destination}`
  const routeIsInSource = Boolean(sourceRouteCarbon[routeKey])
  const driverDelta = adjustedPrediction.candidates - currentPrediction.candidates
  const fareDelta = adjustedPrediction.fare - currentPrediction.fare
  const dispatchDelta = adjustedPrediction.dispatchMinutes - currentPrediction.dispatchMinutes

  const selectedConditions = [
    ['출발지', cargo.origin || '미선택'],
    ['도착지', cargo.destination || '미선택'],
    ['차량', cargo.vehicle || '미선택'],
    ['품목', cargo.item || '미선택'],
    ['상차 날짜', formatDate(cargo.loadingDate)],
    ['상차 시간', formatTimeWindow(cargo)],
    ['별도 톨비', '미합산'],
    ['원본 표본', routeIsInSource ? '노선별 표본 있음' : '노선 일치 없음'],
  ]

  if (!complete) {
    return (
      <div className="flow-screen">
        <header className="flow-heading"><div><span className="eyebrow">SOURCE-BOUND COMPARISON</span><h1>조건 비교</h1><p>콜 등록을 완료하면 현재 조건과 완화 조건을 비교합니다.</p></div></header>
        <section className="empty-comparison panel-v3"><Icon name="compare" size={38} /><h2>비교할 운송 기본 정보가 없습니다.</h2><p>출발지·도착지·차량·품목·상차 날짜·상차 시간을 모두 선택해 주세요.</p><button className="primary-v3" onClick={onOpenRegistration} type="button">콜 등록 열기</button></section>
      </div>
    )
  }

  return (
    <div className="flow-screen comparison-screen">
      <header className="flow-heading">
        <div><span className="eyebrow">SOURCE-BOUND COMPARISON</span><h1>조건 비교</h1><p>현재 조건과 상차 시간 완화 조건, 두 결과만 비교합니다.</p></div>
        <div className="flow-heading__progress"><span>조건 비교 진행률</span><strong>{choice ? '3/3' : '2/3'}</strong><div><i style={{ width: choice ? '100%' : '67%' }} /></div></div>
      </header>

      <section className="comparison-kpis panel-v3">
        <div><span>예상 수락 가능 차주</span><strong>{adjustedPrediction.candidates.toLocaleString('ko-KR')}명</strong></div>
        <div><span>예상 운임</span><strong>{formatCurrency(adjustedPrediction.fare)}</strong></div>
        <div><span>예상 배차 시간</span><strong>{adjustedPrediction.dispatchMinutes}분</strong></div>
        <div><span>유찰 확률</span><strong className="is-unavailable">원본 근거 없음</strong></div>
        <div><span>추정 신뢰도</span><strong>78%</strong></div>
        <div><span>상차 시간창</span><strong>{adjustedHours}시간</strong></div>
      </section>

      <section className={`interpretation-box ${routeIsInSource ? 'is-source' : ''}`}>
        <Icon name="info" size={22} />
        <div><h2>기본 조건 해석</h2><p>{routeIsInSource ? '선택한 노선은 탄소 보고서의 노선별 참조표에 포함되어 있습니다.' : '선택한 조건은 연결된 원본의 참조 범위 밖이라 데모 산식으로 표시했습니다.'}</p><small>{routeIsInSource ? '(탄소 노선 표본 있음 · 운임/배차는 기획안 끝점 보간 · 별도 비용 미합산)' : '(원본 참조 범위 밖 · 원(KRW) 정수 · 별도 비용 미합산)'}</small></div>
      </section>

      <section className="comparison-pair">
        <article className={`comparison-card ${choice === 'current' ? 'is-chosen' : ''}`}>
          <header><div><span>현재</span><h2>현재 조건 그대로</h2></div>{choice === 'current' && <em><Icon name="check" size={14} /> 최근 선택</em>}</header>
          <PredictionFacts prediction={currentPrediction} />
          <p className="comparison-card__window">등록 시간창 {formatTimeWindow(cargo)}</p>
        </article>
        <div className="comparison-deltas">
          <Delta label="차주 변화" value={`${driverDelta >= 0 ? '+' : ''}${driverDelta.toLocaleString('ko-KR')}명`} />
          <Delta label="운임 변화" value={`${fareDelta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(fareDelta))}`} />
          <Delta label="배차시간 변화" value={`${dispatchDelta >= 0 ? '+' : '−'}${Math.abs(dispatchDelta)}분`} />
          <span className="comparison-delta"><small>유찰 확률</small><strong>산출 불가</strong></span>
        </div>
        <article className={`comparison-card comparison-card--adjusted ${choice === 'adjusted' ? 'is-chosen' : ''}`}>
          <header><div><span>완화</span><h2>상차 시간 완화</h2></div>{choice === 'adjusted' && <em><Icon name="check" size={14} /> 최근 선택</em>}</header>
          <PredictionFacts prediction={adjustedPrediction} />
          <p className="comparison-card__window">상차 가능 범위 {adjustedHours}시간</p>
        </article>
      </section>

      <section className="window-adjuster panel-v3">
        <div className="window-adjuster__head"><div><h2>상차 시간창 직접 조정</h2><p>기획안에 제시된 3시간·48시간 끝점 사이에서만 비교합니다.</p></div><strong>{adjustedHours}시간</strong></div>
        <div className="window-adjuster__range"><span>3시간<small>원본 시작점</small></span><input aria-label="완화 상차 시간창" max="48" min={Math.max(3, Math.ceil(currentHours ?? 3))} onChange={(event) => setAdjustedHours(Number(event.target.value))} type="range" value={adjustedHours} /><span>48시간<small>원본 끝점</small></span></div>
        <p className="model-event"><Icon name="spark" size={17} /> 시간창을 {Math.max(0, adjustedHours - (currentHours ?? 3)).toFixed(0)}시간 넓히면 후보는 {driverDelta.toLocaleString('ko-KR')}명 늘고, 예상 운임은 {formatCurrency(Math.abs(fareDelta))}, 배차시간은 {Math.abs(dispatchDelta)}분 줄어드는 참조 결과입니다.</p>
      </section>

      <section className="selected-condition-strip panel-v3"><h2>현재 선택한 조건</h2><dl>{selectedConditions.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value === '미선택' || value.includes('없음') ? 'is-unselected' : ''}>{value}</dd></div>)}</dl></section>

      <div className="comparison-footer">
        <div className="calculation-note"><Icon name="leaf" size={18} /><span><strong>탄소 참고: 건당 {carbon.value}kgCO₂e 감축</strong>{carbon.basis} · {carbon.scope}</span></div>
        <div className="comparison-actions"><button onClick={() => setDialogChoice('current')} type="button">현재 조건대로 진행</button><button className="primary-v3" onClick={() => setDialogChoice('adjusted')} type="button">조정안으로 진행</button></div>
        <small>기획안 끝점 기반 선형 보간 · 탄소 보고서 방식 B · Gemini Flash 기반 자료 해석</small>
      </div>

      {dialogChoice && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="decision-dialog-title" aria-modal="true" className="decision-dialog" role="dialog">
            <button aria-label="알림창 닫기" className="modal-close" onClick={() => setDialogChoice(null)} type="button">×</button>
            <span className="dialog-icon"><Icon name="compare" /></span>
            <h2 id="decision-dialog-title">어떤 조건으로 진행할까요?</h2>
            <p>현재 조건과 완화 조건은 같은 자료 범위와 계산 규칙으로 비교했습니다.</p>
            <div className="dialog-source"><Icon name="info" size={17} /> 기획자료 3h↔48h 끝점 · 신뢰도 78% · 별도 비용 미합산 · 유찰 확률 미산출</div>
            <div className="dialog-options">
              <button className={dialogChoice === 'current' ? 'is-selected' : ''} onClick={() => setDialogChoice('current')} type="button"><span>현재 조건 그대로</span><strong>{currentPrediction.candidates.toLocaleString('ko-KR')}명 · {formatCurrency(currentPrediction.fare)} · {currentPrediction.dispatchMinutes}분</strong></button>
              <button className={dialogChoice === 'adjusted' ? 'is-selected' : ''} onClick={() => setDialogChoice('adjusted')} type="button"><span>조정안 사용</span><strong>{adjustedPrediction.candidates.toLocaleString('ko-KR')}명 · {formatCurrency(adjustedPrediction.fare)} · {adjustedPrediction.dispatchMinutes}분</strong></button>
            </div>
            <button className="primary-v3 dialog-confirm" onClick={() => { onChoose(dialogChoice, adjustedHours); setDialogChoice(null) }} type="button">{dialogChoice === 'adjusted' ? '조정안으로 등록' : '현재 조건대로 등록'} <Icon name="chevron" size={18} /></button>
          </section>
        </div>
      )}
    </div>
  )
}
