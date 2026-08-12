import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { comparisonWindowMinutes, pickScenario, scenarioToPrediction } from '../../lib/adapters'
import type { CatalogOptionsResponse } from '../../lib/types'
import { useShipperMatch } from './useShipperMatch'
import {
  cargoIsComplete,
  describeLevers,
  emptyLevers,
  formatCurrency,
  formatDate,
  formatRisk,
  formatTimeWindow,
  getDateShiftCost,
  getLeadHours,
  getWindowHours,
  maxDateShiftDays,
  predictWithLevers,
  shiftLoadingDate,
  timeChangeCostOptions,
  vehicleFlexCandidateMultiplier,
  type CargoForm,
  type DecisionChoice,
  type LeverState,
  type Prediction,
} from './shipperModel'

type ConditionComparisonProps = {
  cargo: CargoForm
  choice: DecisionChoice
  onChoose: (choice: Exclude<DecisionChoice, null>, levers: LeverState) => void
  onOpenRegistration: () => void
  catalog: CatalogOptionsResponse | null
}

/** 예측 출처를 화면 상단에 알립니다. 예측 서버 값과 로컬 참고값을 섞어 보여주지 않기 위해서입니다. */
function PredictionSourceNotice({ state }: { state: { kind: 'server' | 'local' | 'loading'; message: string } }) {
  if (state.kind === 'server') {
    return (
      <section className="interpretation-box is-source">
        <Icon name="info" size={22} />
        <div><h2>예상 결과 안내</h2><p>{state.message}</p></div>
      </section>
    )
  }
  return (
    <section className="interpretation-box">
      <Icon name={state.kind === 'loading' ? 'clock' : 'shield'} size={22} />
      <div><h2>{state.kind === 'loading' ? '예측 서버 응답을 기다리는 중' : '참고값으로 표시 중'}</h2><p>{state.message}</p></div>
    </section>
  )
}

function PredictionFacts({ prediction }: { prediction: Prediction }) {
  return (
    <dl className="prediction-facts">
      <div><dt>예상 수락 가능 차주</dt><dd>{prediction.candidates.toLocaleString('ko-KR')}명</dd></div>
      <div><dt>예상 운임</dt><dd>{formatCurrency(prediction.fare)}</dd></div>
      <div><dt>예상 배차 시간</dt><dd>{prediction.dispatchMinutes}분</dd></div>
      <div><dt>상차 시간창</dt><dd>{prediction.windowHours}시간</dd></div>
      <div><dt>유찰 위험</dt><dd>{formatRisk(prediction.failureProbability)}</dd></div>
    </dl>
  )
}

function Delta({ value, label }: { value: string; label: string }) {
  return <span className="comparison-delta"><small>{label}</small><strong>{value}</strong><Icon name="chevron" size={16} /></span>
}

export function ConditionComparison({ cargo, choice, onChoose, onOpenRegistration, catalog }: ConditionComparisonProps) {
  const currentHours = getWindowHours(cargo.startMinutes, cargo.endMinutes)
  const leadHours = getLeadHours(cargo) ?? 24
  const initialWindow = Math.min(48, Math.max(12, Math.ceil((currentHours ?? 3) + 9)))
  const [levers, setLevers] = useState<LeverState>({ ...emptyLevers, windowHours: initialWindow })
  const [dialogChoice, setDialogChoice] = useState<Exclude<DecisionChoice, null> | null>(null)
  const complete = cargoIsComplete(cargo)

  useEffect(() => {
    setLevers((current) => ({ ...current, windowHours: Math.min(48, Math.max(12, Math.ceil((currentHours ?? 3) + 9))) }))
  }, [currentHours])

  const currentLevers = useMemo<LeverState>(
    () => ({ ...emptyLevers, windowHours: currentHours ?? 3, timeChangeCostPerHour: levers.timeChangeCostPerHour }),
    [currentHours, levers.timeChangeCostPerHour],
  )

  // 완화 조건을 적용하면 응답의 current까지 함께 바뀌므로, 비교 기준은 레버를 끈 상태로 따로 요청합니다.
  const baselineLevers = useMemo<LeverState>(() => ({ ...emptyLevers, windowHours: currentHours ?? 3 }), [currentHours])
  const baselineMatch = useShipperMatch(cargo, baselineLevers, catalog, complete)
  const adjustedMatch = useShipperMatch(cargo, levers, catalog, complete)

  const baselineScenario = baselineMatch.status === 'ready' ? baselineMatch.data?.current ?? null : null
  const scenarios = useMemo(
    () => (adjustedMatch.status === 'ready' ? adjustedMatch.data?.timeWindowScenarios ?? [] : []),
    [adjustedMatch.data, adjustedMatch.status],
  )
  const usingServer = baselineScenario !== null && scenarios.length > 0

  // 슬라이더는 서버가 실제로 평가한 시간창 위에서만 움직입니다.
  // 서버 값을 못 쓰는 동안에는 같은 사다리를 로컬 계산에 씁니다.
  const windowChoices = useMemo(() => {
    const minimumMinutes = Math.round((currentHours ?? 3) * 60)
    const source = usingServer ? scenarios.map((scenario) => scenario.loadingWindowMinutes) : comparisonWindowMinutes
    const values = [...new Set(source)].filter((minutes) => minutes >= minimumMinutes).sort((left, right) => left - right)
    return (values.length ? values : [minimumMinutes]).map((minutes) => Math.round((minutes / 60) * 10) / 10
    )
  }, [currentHours, scenarios, usingServer])

  const selectedWindowIndex = useMemo(() => {
    let closest = 0
    for (let index = 1; index < windowChoices.length; index += 1) {
      if (Math.abs(windowChoices[index] - levers.windowHours) < Math.abs(windowChoices[closest] - levers.windowHours)) closest = index
    }
    return closest
  }, [levers.windowHours, windowChoices])

  const adjustedScenario = usingServer ? pickScenario(scenarios, levers.windowHours) : null
  const currentPrediction = useMemo(
    () => (baselineScenario ? scenarioToPrediction(baselineScenario) : predictWithLevers(leadHours, currentLevers)),
    [baselineScenario, currentLevers, leadHours],
  )
  const adjustedPrediction = useMemo(
    () => (adjustedScenario ? scenarioToPrediction(adjustedScenario) : predictWithLevers(leadHours, levers)),
    [adjustedScenario, leadHours, levers],
  )

  const loading = baselineMatch.status === 'loading' || adjustedMatch.status === 'loading'
  const blocked = adjustedMatch.status === 'unavailable' ? adjustedMatch : baselineMatch.status === 'unavailable' ? baselineMatch : null
  const failed = adjustedMatch.status === 'error' ? adjustedMatch : baselineMatch.status === 'error' ? baselineMatch : null
  const sourceState = usingServer
    ? { kind: 'server' as const, message: '예상 수치는 v13 생성 데이터와 학습 모델이 계산한 값이며 실제 배차 과정에서 달라질 수 있습니다.' }
    : loading
      ? { kind: 'loading' as const, message: '조건에 맞는 후보와 예상 운임을 계산하고 있습니다.' }
      : blocked
        ? { kind: 'local' as const, message: `${blocked.message} 아래 수치는 원자료 기반 참고값입니다.` }
        : { kind: 'local' as const, message: `${failed?.message ?? '예측 서버에 연결하지 못했습니다.'} 아래 수치는 원자료 기반 참고값입니다.` }

  const driverDelta = adjustedPrediction.candidates - currentPrediction.candidates
  const fareDelta = adjustedPrediction.fare - currentPrediction.fare
  const dispatchDelta = adjustedPrediction.dispatchMinutes - currentPrediction.dispatchMinutes
  const riskDelta = (adjustedPrediction.failureProbability ?? 0) - (currentPrediction.failureProbability ?? 0)
  const shiftCost = getDateShiftCost(levers)
  const appliedLevers = describeLevers(levers, currentHours ?? 3)
  const netFareEffect = -fareDelta - shiftCost

  if (!complete) {
    return (
      <div className="flow-screen">
        <header className="flow-heading"><div><h1>조건 비교</h1><p>콜 등록을 완료하면 현재 조건과 완화 조건을 비교합니다.</p></div></header>
        <section className="empty-comparison panel-v3"><Icon name="compare" size={38} /><h2>비교할 운송 기본 정보가 없습니다.</h2><p>출발지·도착지·차량·품목·품목 상세·중량·상차 날짜·상차 시간을 모두 입력해 주세요.</p><button className="primary-v3" onClick={onOpenRegistration} type="button">콜 등록 열기</button></section>
      </div>
    )
  }

  return (
    <div className="flow-screen comparison-screen">
      <header className="flow-heading">
        <div><h1>조건 비교</h1><p>현재 조건과 완화 조건, 두 결과만 비교합니다. 시간창·차종·상차일 세 가지를 조정할 수 있어요.</p></div>
        <div className="flow-heading__progress"><span>조건 비교 진행률</span><strong>{choice ? '3/3' : '2/3'}</strong><div><i style={{ width: choice ? '100%' : '67%' }} /></div></div>
      </header>

      <section className="comparison-kpis panel-v3">
        <div><span>예상 수락 가능 차주</span><strong>{adjustedPrediction.candidates.toLocaleString('ko-KR')}명</strong></div>
        <div><span>예상 운임</span><strong>{formatCurrency(adjustedPrediction.fare)}</strong></div>
        <div><span>예상 배차 시간</span><strong>{adjustedPrediction.dispatchMinutes}분</strong></div>
        <div><span>상차 시간창</span><strong>{levers.windowHours}시간</strong></div>
        <div><span>유찰 위험</span><strong>{formatRisk(adjustedPrediction.failureProbability)}</strong></div>
      </section>

      <PredictionSourceNotice state={sourceState} />
      {failed && !usingServer && (
        <div className="screen-actions">
          <button onClick={() => { baselineMatch.retry(); adjustedMatch.retry() }} type="button">예측 서버 다시 시도</button>
        </div>
      )}

      <section className="comparison-pair">
        <article className={`comparison-card ${choice === 'current' ? 'is-chosen' : ''}`}>
          <header><div><span>현재</span><h2>현재 조건 그대로</h2></div>{choice === 'current' && <em><Icon name="check" size={14} /> 최근 선택</em>}</header>
          <PredictionFacts prediction={currentPrediction} />
          <p className="comparison-card__window">등록 시간창 {formatTimeWindow(cargo)} · 지정 차종 단일 · 상차일 {formatDate(cargo.loadingDate)}</p>
        </article>
        <div className="comparison-deltas">
          <Delta label="차주 변화" value={`${driverDelta >= 0 ? '+' : ''}${driverDelta.toLocaleString('ko-KR')}명`} />
          <Delta label="운임 변화" value={`${fareDelta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(fareDelta))}`} />
          <Delta label="배차시간 변화" value={`${dispatchDelta >= 0 ? '+' : '−'}${Math.abs(dispatchDelta)}분`} />
          <Delta label="유찰 위험 변화" value={`${riskDelta >= 0 ? '+' : '−'}${Math.abs(riskDelta * 100).toFixed(1)}%p`} />
        </div>
        <article className={`comparison-card comparison-card--adjusted ${choice === 'adjusted' ? 'is-chosen' : ''}`}>
          <header><div><span>완화</span><h2>조건 완화</h2></div>{choice === 'adjusted' && <em><Icon name="check" size={14} /> 최근 선택</em>}</header>
          <PredictionFacts prediction={adjustedPrediction} />
          <p className="comparison-card__window">{appliedLevers.length ? appliedLevers.join(' · ') : '적용한 완화 조건 없음'}</p>
        </article>
      </section>

      <section className="window-adjuster panel-v3">
        <div className="window-adjuster__head"><div><h2>상차 시간 조정</h2><p>{usingServer ? '예측 서버가 한 번에 계산한 시간창 중에서 고릅니다.' : '가능한 상차 시간을 넓혀 배차 결과 변화를 확인하세요.'}</p></div><strong>{levers.windowHours}시간</strong></div>
        <div className="window-adjuster__range">
          <span>{windowChoices[0]}시간<small>최소</small></span>
          <input
            aria-label="완화 상차 시간창"
            aria-valuetext={`${levers.windowHours}시간`}
            disabled={windowChoices.length < 2}
            max={windowChoices.length - 1}
            min={0}
            onChange={(event) => setLevers({ ...levers, windowHours: windowChoices[Number(event.target.value)] })}
            step={1}
            type="range"
            value={selectedWindowIndex}
          />
          <span>{windowChoices[windowChoices.length - 1]}시간<small>최대</small></span>
        </div>
      </section>

      <section className="lever-row">
        <article className={`lever-card panel-v3 ${levers.vehicleFlexible ? 'is-on' : ''}`}>
          <header>
            <div><h2>차종 대체 허용</h2><p>{cargo.vehicle || '지정 차종'} 외에 상위 톤급·유사 적재형태까지 배차 후보로 받습니다.</p></div>
            <button aria-checked={levers.vehicleFlexible} aria-label="차종 대체 허용" className="lever-switch" onClick={() => setLevers({ ...levers, vehicleFlexible: !levers.vehicleFlexible })} role="switch" type="button"><i /></button>
          </header>
          <p className="lever-effect">
            {usingServer
              ? levers.vehicleFlexible
                ? `대체 허용 조건으로 다시 계산해 후보가 ${currentPrediction.candidates.toLocaleString('ko-KR')}명에서 ${adjustedPrediction.candidates.toLocaleString('ko-KR')}명이 되었습니다.`
                : '켜면 상위 톤급·유사 적재형태를 포함해 예측 서버가 후보를 다시 계산합니다.'
              : levers.vehicleFlexible
                ? `후보 ${vehicleFlexCandidateMultiplier}배 · 배차 30% 단축 · 운임 3% 하락을 반영했습니다.`
                : `켜면 후보가 ${vehicleFlexCandidateMultiplier}배로 늘고 배차시간이 30% 짧아집니다. 원자료 12,000건에서 단일 지정 64명 → 대체허용 230명.`}
          </p>
        </article>

        <article className={`lever-card panel-v3 ${levers.dateShiftDays > 0 ? 'is-on' : ''}`}>
          <header>
            <div><h2>상차일 연기</h2><p>상차일을 미뤄 리드타임을 늘리면 유찰 위험이 내려갑니다.</p></div>
            <div className="lever-stepper">
              <button aria-label="연기 일수 줄이기" disabled={levers.dateShiftDays === 0} onClick={() => setLevers({ ...levers, dateShiftDays: levers.dateShiftDays - 1 })} type="button">−</button>
              <strong>{levers.dateShiftDays === 0 ? '연기 없음' : `+${levers.dateShiftDays}일`}</strong>
              <button aria-label="연기 일수 늘리기" disabled={levers.dateShiftDays === maxDateShiftDays} onClick={() => setLevers({ ...levers, dateShiftDays: levers.dateShiftDays + 1 })} type="button">+</button>
            </div>
          </header>
          {levers.dateShiftDays > 0 && (
            <label className="lever-cost">
              <span>시간당 기회비용</span>
              <select onChange={(event) => setLevers({ ...levers, timeChangeCostPerHour: Number(event.target.value) })} value={levers.timeChangeCostPerHour}>
                {timeChangeCostOptions.map((option) => <option key={option} value={option}>{option === 0 ? '추가비용 없음' : `${option.toLocaleString('ko-KR')}원/시간`}</option>)}
              </select>
            </label>
          )}
          <p className="lever-effect">
            {levers.dateShiftDays > 0
              ? `상차일 ${formatDate(cargo.loadingDate)} → ${formatDate(shiftLoadingDate(cargo.loadingDate, levers.dateShiftDays))} · 리드타임 ${Math.round(leadHours)}h → ${Math.round(leadHours + levers.dateShiftDays * 24)}h${shiftCost ? ` · 기회비용 ${formatCurrency(shiftCost)}` : ' · 추가비용 없음'}`
              : `현재 리드타임 ${Math.round(leadHours)}시간. 하루 미루면 유찰 위험이 내려가고 운임도 3% 낮아집니다. 후보 수와 배차시간은 그대로입니다.`}
          </p>
        </article>
      </section>

      <section className="lever-summary panel-v3">
        <p className="model-event">
          <Icon name="spark" size={17} />
          {appliedLevers.length
            ? `${appliedLevers.join(' + ')}을 적용하면 후보는 ${driverDelta >= 0 ? '' : '−'}${Math.abs(driverDelta).toLocaleString('ko-KR')}명 ${driverDelta >= 0 ? '늘고' : '줄고'}, 배차시간은 ${Math.abs(dispatchDelta)}분 ${dispatchDelta <= 0 ? '줄며' : '늘며'}, 유찰 위험은 ${formatRisk(currentPrediction.failureProbability)} → ${formatRisk(adjustedPrediction.failureProbability)}로 바뀝니다.`
            : '아직 완화한 조건이 없습니다. 시간창·차종·상차일 중 하나를 조정하면 결과 변화가 계산됩니다.'}
        </p>
        {appliedLevers.length > 0 && (
          <p className={`lever-net ${netFareEffect >= 0 ? 'is-gain' : 'is-loss'}`}>
            <Icon name="wallet" size={17} />
            금전 효과 합계 {netFareEffect >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netFareEffect))}
            <small>운임 {fareDelta <= 0 ? '절감' : '증가'} {formatCurrency(Math.abs(fareDelta))}{shiftCost ? ` · 상차일 연기 기회비용 ${formatCurrency(shiftCost)}` : ''}</small>
          </p>
        )}
      </section>

      <div className="comparison-footer">
        <div className="comparison-actions"><button onClick={() => setDialogChoice('current')} type="button">현재 조건대로 진행</button><button className="primary-v3" disabled={!appliedLevers.length} onClick={() => setDialogChoice('adjusted')} type="button">조정안으로 진행</button></div>
      </div>

      {dialogChoice && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="decision-dialog-title" aria-modal="true" className="decision-dialog" role="dialog">
            <button aria-label="알림창 닫기" className="modal-close" onClick={() => setDialogChoice(null)} type="button">×</button>
            <span className="dialog-icon"><Icon name="compare" /></span>
            <h2 id="decision-dialog-title">어떤 조건으로 진행할까요?</h2>
            <p>예상 결과를 확인하고 진행할 조건을 선택하세요.</p>
            <div className="dialog-options">
              <button className={dialogChoice === 'current' ? 'is-selected' : ''} onClick={() => setDialogChoice('current')} type="button"><span>현재 조건 그대로</span><strong>{currentPrediction.candidates.toLocaleString('ko-KR')}명 · {formatCurrency(currentPrediction.fare)} · {currentPrediction.dispatchMinutes}분 · 유찰 {formatRisk(currentPrediction.failureProbability)}</strong></button>
              <button className={dialogChoice === 'adjusted' ? 'is-selected' : ''} disabled={!appliedLevers.length} onClick={() => setDialogChoice('adjusted')} type="button"><span>조정안 사용{appliedLevers.length ? ` (${appliedLevers.join(' · ')})` : ''}</span><strong>{adjustedPrediction.candidates.toLocaleString('ko-KR')}명 · {formatCurrency(adjustedPrediction.fare)} · {adjustedPrediction.dispatchMinutes}분 · 유찰 {formatRisk(adjustedPrediction.failureProbability)}</strong></button>
            </div>
            <button className="primary-v3 dialog-confirm" onClick={() => { onChoose(dialogChoice, dialogChoice === 'adjusted' ? levers : currentLevers); setDialogChoice(null) }} type="button">{dialogChoice === 'adjusted' ? '조정안으로 등록' : '현재 조건대로 등록'} <Icon name="chevron" size={18} /></button>
          </section>
        </div>
      )}
    </div>
  )
}
