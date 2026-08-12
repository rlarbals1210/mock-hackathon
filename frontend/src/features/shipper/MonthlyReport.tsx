import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  formatCurrency,
  formatTimeWindow,
  getCarbonReference,
  getWindowHours,
  interpolatePrediction,
  type CargoForm,
  type DecisionChoice,
  type OperationLog,
} from './shipperModel'

type MonthlyReportProps = {
  cargo: CargoForm
  choice: DecisionChoice
  adjustedHours: number
  operations: OperationLog[]
}

function localAnalysis(choice: DecisionChoice, adjustedHours: number, fareDelta: number, dispatchDelta: number) {
  if (!choice) return '아직 비교 결과가 선택되지 않았습니다. 조건 비교에서 현재 조건 또는 조정안을 선택하면 화주 관점의 자료 요약이 여기에 생성됩니다.'
  if (choice === 'current') return '최근 배차는 등록한 상차 시간창을 그대로 유지했습니다. 기획자료의 참조 범위에서는 조건을 넓힐 때 후보 수와 배차시간이 개선되지만, 이번 선택은 일정 확정성을 우선한 결과입니다.'
  return `최근 배차는 상차 가능 범위를 ${adjustedHours}시간으로 넓힌 조정안을 선택했습니다. 기획자료 끝점 비교 기준으로 예상 운임은 ${formatCurrency(Math.abs(fareDelta))}, 예상 배차시간은 ${Math.abs(dispatchDelta)}분 줄어드는 방향이며, 탄소 값은 국내계수판 방식 B의 집계값으로 별도 표시했습니다.`
}

export function MonthlyReport({ cargo, choice, adjustedHours, operations }: MonthlyReportProps) {
  const [showReport, setShowReport] = useState(false)
  const currentHours = getWindowHours(cargo.startMinutes, cargo.endMinutes) ?? 3
  const currentPrediction = useMemo(() => interpolatePrediction(currentHours), [currentHours])
  const selectedPrediction = useMemo(() => interpolatePrediction(choice === 'adjusted' ? adjustedHours : currentHours), [adjustedHours, choice, currentHours])
  const fareDelta = selectedPrediction.fare - currentPrediction.fare
  const dispatchDelta = selectedPrediction.dispatchMinutes - currentPrediction.dispatchMinutes
  const carbon = getCarbonReference(cargo)
  const fallback = localAnalysis(choice, adjustedHours, fareDelta, dispatchDelta)
  const [analysis, setAnalysis] = useState(fallback)
  const [analysisSource, setAnalysisSource] = useState<'local' | 'gemini' | 'loading'>('local')

  useEffect(() => {
    setAnalysis(fallback)
    if (!choice) {
      setAnalysisSource('local')
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 6500)
    setAnalysisSource('loading')
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        choice,
        route: `${cargo.origin || '미선택'} → ${cargo.destination || '미선택'}`,
        vehicle: cargo.vehicle || '미선택',
        item: cargo.item || '미선택',
        loadingWindow: choice === 'adjusted' ? `${adjustedHours}시간` : formatTimeWindow(cargo),
        candidates: selectedPrediction.candidates,
        fare: selectedPrediction.fare,
        dispatchMinutes: selectedPrediction.dispatchMinutes,
        fareDelta,
        dispatchDelta,
        carbonKgPerOrder: carbon.value,
        carbonBasis: carbon.basis,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Gemini endpoint unavailable')
        const data = await response.json() as { text?: string }
        if (!data.text) throw new Error('Gemini response empty')
        setAnalysis(data.text)
        setAnalysisSource('gemini')
      })
      .catch(() => {
        setAnalysis(fallback)
        setAnalysisSource('local')
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [adjustedHours, cargo, carbon.basis, carbon.value, choice, dispatchDelta, fallback, fareDelta, selectedPrediction.candidates, selectedPrediction.dispatchMinutes, selectedPrediction.fare])

  const timeProposals = choice ? 1 : 0
  const proposalAcceptance = choice === 'adjusted' ? 100 : choice === 'current' ? 0 : null
  const statusRows = [
    ['최근 선택', choice === 'adjusted' ? '조정안 사용' : choice === 'current' ? '현재 조건 유지' : '미선택'],
    ['운송인 응답', choice ? '응답 대기' : '선택 대기'],
    ['최근 배차 결과', choice ? '조건 등록 완료 · 응답 대기' : '조건 조합 전'],
  ]

  return (
    <div className="flow-screen monthly-report">
      <header className="flow-heading report-heading">
        <div><span className="eyebrow">MONTHLY SHIPPER REPORT</span><h1>월간 배차 리포트</h1><p>조건 선택 결과와 탄소 감축 근거를 화주 관점으로 정리했습니다.</p></div>
        <div className="report-heading__actions"><select aria-label="리포트 월" defaultValue="2026-08"><option value="2026-08">2026년 8월</option></select><button className="primary-v3" onClick={() => setShowReport(true)} type="button"><Icon name="chart" size={18} /> 데이터 리포트 저장</button></div>
      </header>

      <section className="ai-analysis panel-v3">
        <span className="ai-analysis__icon"><Icon name="spark" /></span>
        <div><header><h2>Gemini Flash 자료 해석</h2><em>{analysisSource === 'gemini' ? '생성형 AI · 자료 근거 요약' : analysisSource === 'loading' ? 'Gemini 응답 확인 중' : '자료 기반 로컬 요약 · Gemini 연결 대기'}</em></header><p>{analysis}</p><div className="source-chips"><span>기획자료 최종</span><span>탄소배출 국내계수판</span><span>12,000건 가상 오더</span></div></div>
      </section>

      <section className="report-kpis">
        <article><Icon name="clock" /><span>중앙 배차시간 단축</span><strong>25분</strong><small>기획안 40분 → 15분</small></article>
        <article><Icon name="users" /><span>조정 가능 콜</span><strong className="is-text">원본 집계 없음</strong><small>원자료에 월간 건수 미제공</small></article>
        <article><Icon name="wallet" /><span>예상 운임 차이</span><strong>−40,000원</strong><small>기획안 42만원 → 38만원</small></article>
        <article><Icon name="chart" /><span>분석 오더</span><strong>12,000건</strong><small>탄소 보고서 가상 표본</small></article>
      </section>

      <section className="report-detail-grid">
        <article className="carbon-impact panel-v3">
          <div className="section-heading-v3"><Icon name="leaf" /><div><h2>탄소 감축 효과</h2><p>국내계수판 방식 B</p></div></div>
          <div className="carbon-impact__values"><div><span>총</span><strong>673.5</strong><small>tCO₂e 감축</small></div><div><span>건당</span><strong>56.1</strong><small>kgCO₂e</small></div><div><span>감축률</span><strong>19.8%</strong><small>총 배출 대비</small></div></div>
          <code>방식 B: ΔE_B = ΔE_A × (1 − w/48)</code>
          <p>연료계수 2.609kgCO₂/L는 공식, 톤급별 연비는 보고서 가정을 적용했습니다.</p>
        </article>
        <article className="operation-analysis panel-v3">
          <div className="section-heading-v3"><Icon name="chart" /><div><h2>운영 성과 분석</h2><p>원본 표본과 이번 데모 선택을 분리 표시</p></div></div>
          <div className="operation-analysis__stats"><div><span>시간 제안</span><strong>{timeProposals}건</strong></div><div><span>제안 수락률</span><strong>{proposalAcceptance === null ? '미산출' : `${proposalAcceptance}%`}</strong></div><div><span>성사 중앙 배차</span><strong>{choice ? `${selectedPrediction.dispatchMinutes}분` : '미선택'}</strong></div></div>
          <div className="comparison-bars"><div><span>배차시간</span><i><b style={{ width: '100%' }} /></i><em>40</em></div><div><span>선택 결과</span><i><b className="is-selected" style={{ width: `${Math.max(15, (selectedPrediction.dispatchMinutes / 40) * 100)}%` }} /></i><em>{selectedPrediction.dispatchMinutes}</em></div><div><span>예상운임</span><i><b style={{ width: '100%' }} /></i><em>42만</em></div><div><span>선택 결과</span><i><b className="is-selected" style={{ width: `${(selectedPrediction.fare / 420000) * 100}%` }} /></i><em>{Math.round(selectedPrediction.fare / 10000)}만</em></div></div>
        </article>
      </section>

      <section className="report-bottom-grid">
        <article className="recent-choice panel-v3"><div className="section-heading-v3"><Icon name="compare" /><div><h2>최근 선택 결과</h2><p>응답 상태는 외부 연결 없이 수동 상태로 표시</p></div></div><dl>{statusRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="recent-choice__carbon"><Icon name="leaf" size={18} /><span>이번 콜 탄소 참고</span><strong>{carbon.value}kgCO₂e/건</strong><small>{carbon.scope}</small></div></article>
        <article className="operation-log pdf-hide-recent-operations panel-v3"><div className="section-heading-v3"><Icon name="clock" /><div><h2>최근 운영 기록</h2><p>브라우저에 저장된 데모 작업</p></div></div><ol>{operations.length ? operations.slice(0, 5).map((operation) => <li key={operation.id}><time>{operation.time}</time><div><strong>{operation.title}</strong><span>{operation.detail}</span></div></li>) : <li className="is-empty"><span>아직 저장된 운영 기록이 없습니다.</span></li>}</ol></article>
      </section>

      {showReport && (
        <div className="modal-backdrop report-modal-backdrop" role="presentation">
          <section aria-labelledby="report-dialog-title" aria-modal="true" className="report-dialog" role="dialog">
            <header><div><span className="eyebrow">MOV!N DATA REPORT · 2026.08</span><h2 id="report-dialog-title">화주 배차조건 선택 리포트</h2><p>{cargo.origin || '미선택'} → {cargo.destination || '미선택'} · {cargo.vehicle || '미선택'} · {cargo.item || '미선택'}</p></div><button aria-label="리포트 닫기" onClick={() => setShowReport(false)} type="button">×</button></header>
            <div className="report-dialog__summary"><article><span>최근 선택</span><strong>{statusRows[0][1]}</strong></article><article><span>예상 배차</span><strong>{choice ? `${selectedPrediction.dispatchMinutes}분` : '미선택'}</strong></article><article><span>예상 운임</span><strong>{choice ? formatCurrency(selectedPrediction.fare) : '미선택'}</strong></article><article><span>탄소 참고</span><strong>{carbon.value}kgCO₂e</strong></article></div>
            <section><h3>Gemini Flash 자료 해석</h3><p>{analysis}</p></section>
            <section><h3>예상 결과 산정 기준</h3><ul><li>수락 가능 차주 수는 등록한 상차 시간과 조정한 시간 범위를 비교해 추정했습니다.</li><li>예상 운임과 배차시간은 현재 조건과 시간 조정안의 비교값입니다.</li><li>탄소 감축량은 국내계수판 방식 B를 적용했습니다.</li><li>톨비 등 별도 비용은 예상 운임에 포함되지 않습니다.</li></ul></section>
            <footer><p>인쇄 창에서 ‘PDF로 저장’을 선택하면 파일로 보관할 수 있습니다.</p><div><button onClick={() => setShowReport(false)} type="button">닫기</button><button className="primary-v3" onClick={() => window.print()} type="button"><Icon name="chart" size={17} /> 인쇄 / PDF 저장</button></div></footer>
          </section>
        </div>
      )}
    </div>
  )
}
