import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { emissionFactors, routeReductions } from '../../data'

export type ShipperSection = 'preferences' | 'register' | 'compare' | 'report' | 'profile'

type PreferenceGroupId = 'result' | 'schedule' | 'carrier'
type PreferenceState = Record<PreferenceGroupId, string[]>
type DispatchStage = 'preference-waiting' | 'carrier-waiting' | 'matching' | 'completed'

type CargoForm = {
  origin: string
  destination: string
  vehicle: string
  item: string
  loadingDate: string
  loadingTime: string
}

const emptyPreferences: PreferenceState = {
  result: [],
  schedule: [],
  carrier: [],
}

const preferenceGroups: {
  id: PreferenceGroupId
  title: string
  options: { label: string; detail?: string }[]
}[] = [
  {
    id: 'result',
    title: '배차 결과에서 중요해요',
    options: [{ label: '빠른 배차' }, { label: '낮은 운임' }, { label: '많은 후보' }],
  },
  {
    id: 'schedule',
    title: '가능한 상차 일정이에요',
    options: [
      { label: '오전 상차', detail: '06:00~12:00' },
      { label: '오후 상차', detail: '12:00~18:00' },
      { label: '야간 상차', detail: '18:00~06:00' },
      { label: '일정 조정 가능' },
    ],
  },
  {
    id: 'carrier',
    title: '운송인 선택에서 중요해요',
    options: [{ label: '안전 기록' }, { label: '정시성' }, { label: '품목 경험' }],
  },
]

const initialCargo: CargoForm = {
  origin: '안산',
  destination: '부산',
  vehicle: '5톤 카고',
  item: '파렛트 12',
  loadingDate: '2026-08-14',
  loadingTime: '',
}

const storageKey = 'movin-shipper-preferences:v1'

function preferencesAreComplete(preferences: PreferenceState) {
  return Object.values(preferences).every((items) => items.length > 0)
}

function loadSavedPreferences(): PreferenceState {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return emptyPreferences
    const parsed = JSON.parse(saved) as Partial<PreferenceState>
    return {
      result: Array.isArray(parsed.result) ? parsed.result.slice(0, 2) : [],
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule.slice(0, 2) : [],
      carrier: Array.isArray(parsed.carrier) ? parsed.carrier.slice(0, 2) : [],
    }
  } catch {
    return emptyPreferences
  }
}

function formatLoadingTime(preferences: PreferenceState, cargo: CargoForm) {
  if (cargo.loadingTime) return cargo.loadingTime
  const schedule = preferences.schedule[0]
  if (!schedule) return '미선택'
  const option = preferenceGroups.find((group) => group.id === 'schedule')?.options.find((item) => item.label === schedule)
  return option?.detail ? `${option.label} ${option.detail}` : option?.label ?? '미선택'
}

function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function SectionProgress({ label, current, total }: { label: string; current: number; total: number }) {
  const percentage = Math.round((current / total) * 100)
  return (
    <div className="section-progress" aria-label={`${label} ${percentage}% 완료`}>
      <span>{label}</span>
      <strong>{current}/{total}</strong>
      <div className="section-progress__track"><i style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}

function RouteSelector({ cargo, onChange }: { cargo: CargoForm; onChange: (cargo: CargoForm) => void }) {
  const update = (key: keyof CargoForm, value: string) => onChange({ ...cargo, [key]: value })
  return (
    <section className="route-selector panel" aria-label="현재 배차 경로 선택">
      <label>
        <span>출발지</span>
        <select value={cargo.origin} onChange={(event) => update('origin', event.target.value)}>
          <option>안산</option>
          <option>인천</option>
          <option>화성</option>
          <option>대전</option>
        </select>
      </label>
      <Icon className="route-selector__arrow" name="chevron" size={22} />
      <label>
        <span>도착지</span>
        <select value={cargo.destination} onChange={(event) => update('destination', event.target.value)}>
          <option>부산</option>
          <option>울산</option>
          <option>대구</option>
          <option>김해</option>
        </select>
      </label>
      <label>
        <span>차량</span>
        <select value={cargo.vehicle} onChange={(event) => update('vehicle', event.target.value)}>
          <option>5톤 카고</option>
          <option>11톤 윙바디</option>
          <option>25톤 카고</option>
        </select>
      </label>
      <span className="route-selector__sync"><i /> 화주·운송인 실시간 연동</span>
    </section>
  )
}

function LiveStatusSummary({
  stage,
  completedPreferenceGroups,
}: {
  stage: DispatchStage
  completedPreferenceGroups: number
}) {
  const preferenceSaved = stage !== 'preference-waiting'
  const carrierResponded = stage === 'matching' || stage === 'completed'
  const dispatchCompleted = stage === 'completed'
  const items = [
    {
      step: 1,
      label: '화주 조건',
      value: preferenceSaved ? '선택 완료' : completedPreferenceGroups === 3 ? '저장 대기' : '선택 대기',
      progress: preferenceSaved ? 100 : Math.round((completedPreferenceGroups / 3) * 100),
      tone: preferenceSaved ? 'complete' : 'waiting',
      detail: preferenceSaved ? '선호 조건이 운송인에게 공유됐어요.' : '화주 조건 선택을 기다리고 있어요.',
    },
    {
      step: 2,
      label: '운송인 응답',
      value: carrierResponded ? '응답 완료' : '응답 대기',
      progress: carrierResponded ? 100 : stage === 'carrier-waiting' ? 52 : 0,
      tone: carrierResponded ? 'complete' : 'waiting',
      detail: carrierResponded ? '운송인이 조건을 확인했어요.' : '운송인의 실시간 응답을 기다려요.',
    },
    {
      step: 3,
      label: '배차 결과',
      value: dispatchCompleted ? '배차 완료' : '조건 조합 중',
      progress: dispatchCompleted ? 100 : stage === 'matching' ? 72 : stage === 'carrier-waiting' ? 34 : 18,
      tone: dispatchCompleted ? 'complete' : 'waiting',
      detail: dispatchCompleted ? '최적 배차 결과가 준비됐어요.' : '화주와 운송인 조건을 조합하고 있어요.',
    },
    {
      step: 4,
      label: '탄소 감축',
      value: '18.4 kgCO₂',
      progress: dispatchCompleted ? 100 : 64,
      tone: 'carbon',
      detail: dispatchCompleted ? '이번 배차의 예상 감축 결과예요.' : '현재 조건 기준 예상 감축량이에요.',
    },
  ]

  return (
    <section className="live-status-panel panel" aria-label="실시간 배차 진행 상황">
      {items.map((item) => (
        <article className={`live-status-item live-status-item--${item.tone}`} key={item.label}>
          <div className="live-status-item__head">
            <span className="live-step">{item.step}</span>
            <strong>{item.label}</strong>
          </div>
          <p>{item.value}</p>
          <div className="live-progress"><i style={{ width: `${item.progress}%` }} /></div>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
  )
}

function DecisionSummary({
  stage,
  cargo,
  completedPreferenceGroups,
}: {
  stage: DispatchStage
  cargo: CargoForm
  completedPreferenceGroups: number
}) {
  const events = [
    {
      title: '화물 정보 등록',
      detail: `${cargo.origin} → ${cargo.destination} / ${cargo.vehicle}`,
      time: '08:42:18',
      state: 'complete',
    },
    {
      title: stage === 'preference-waiting' ? '화주 조건 선택 대기' : '화주 조건 공유 완료',
      detail: stage === 'preference-waiting' ? `${completedPreferenceGroups}/3개 질문 선택 중` : '선택한 조건이 운송인에게 전달됐어요.',
      time: '08:42:30',
      state: stage === 'preference-waiting' ? 'active' : 'complete',
    },
    {
      title: stage === 'matching' || stage === 'completed' ? '운송인 응답 수신' : '운송인 응답 대기',
      detail: stage === 'matching' || stage === 'completed' ? '조건을 확인한 운송인이 응답했어요.' : '운송인의 실시간 응답을 기다리고 있어요.',
      time: '08:42:31',
      state: stage === 'matching' || stage === 'completed' ? 'complete' : 'waiting',
    },
    {
      title: stage === 'completed' ? '배차·탄소 결과 완료' : '탄소 감축 예상 준비',
      detail: stage === 'completed' ? '배차 완료 · 18.4 kgCO₂ 감축' : '예상 감축량 18.4 kgCO₂',
      time: '08:42:45',
      state: stage === 'completed' ? 'complete' : 'carbon',
    },
  ]

  return (
    <aside className="decision-rail panel">
      <div className="decision-rail__heading">
        <h2>실시간 결정 요약</h2>
        <span><i /> LIVE</span>
      </div>
      <div className="decision-timeline" aria-live="polite">
        {events.map((event) => (
          <article className={`decision-event decision-event--${event.state}`} key={event.title}>
            <span className="decision-event__mark">
              {event.state === 'complete' ? <Icon name="check" size={17} /> : event.state === 'carbon' ? <Icon name="leaf" size={17} /> : <Icon name="clock" size={17} />}
            </span>
            <div>
              <time>{event.time}</time>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="decision-rail__footer">
        <Icon name="switch" size={18} />
        <p><strong>화주·운송인 상태 동기화 중</strong><span>선택과 응답을 이 화면에 바로 반영합니다.</span></p>
      </div>
    </aside>
  )
}

function CurrentDispatchInfo({ cargo, preferences, stage }: { cargo: CargoForm; preferences: PreferenceState; stage: DispatchStage }) {
  const status = stage === 'preference-waiting'
    ? '조건 선택 대기'
    : stage === 'carrier-waiting'
      ? '운송인 응답 대기'
      : stage === 'matching'
        ? '조건 조합 중'
        : '배차 완료'
  const fields = [
    ['배차번호', 'MOV-2026-0812-042'],
    ['출발지', cargo.origin],
    ['도착지', cargo.destination],
    ['차량', cargo.vehicle],
    ['품목', cargo.item || '미선택'],
    ['상차 날짜', cargo.loadingDate ? cargo.loadingDate.replaceAll('-', '.') : '미선택'],
    ['상차 시간', formatLoadingTime(preferences, cargo)],
    ['현재 상태', status],
  ]
  return (
    <section className="current-dispatch panel">
      <div className="current-dispatch__title">
        <h2>현재 배차 정보</h2>
        <span>실시간 갱신</span>
      </div>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value === '미선택' ? 'is-unselected' : label === '현재 상태' ? 'is-status' : ''}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PreferenceSettings({
  preferences,
  onChange,
  onSave,
  saved,
}: {
  preferences: PreferenceState
  onChange: (group: PreferenceGroupId, option: string) => void
  onSave: () => void
  saved: boolean
}) {
  const [limitMessage, setLimitMessage] = useState<PreferenceGroupId | null>(null)
  const completedGroups = preferenceGroups.filter((group) => preferences[group.id].length > 0).length
  const ready = completedGroups === preferenceGroups.length

  const toggle = (group: PreferenceGroupId, option: string) => {
    if (!preferences[group].includes(option) && preferences[group].length >= 2) {
      setLimitMessage(group)
      return
    }
    setLimitMessage(null)
    onChange(group, option)
  }

  useEffect(() => {
    if (!limitMessage) return
    const timer = window.setTimeout(() => setLimitMessage(null), 1800)
    return () => window.clearTimeout(timer)
  }, [limitMessage])

  return (
    <div className="preference-screen screen-stack">
      <div className="preference-heading-row">
        <PageHeading title="화주 선호 조건 설정" description="발주할 때 중요하게 보는 조건을 모두 선택하세요." />
        <SectionProgress current={completedGroups} label="전체 진행률" total={3} />
      </div>
      <div className="preference-rule"><Icon name="info" size={18} /> 각 질문에서 하나 이상, 최대 2개까지 선택할 수 있어요.</div>
      <div className="preference-groups">
        {preferenceGroups.map((group, index) => {
          const selected = preferences[group.id]
          return (
            <fieldset className="preference-group panel" key={group.id}>
              <legend className="sr-only">{group.title}</legend>
              <div className="preference-group__head">
                <div><span>{index + 1}</span><h2>{group.title}</h2></div>
                <div className="preference-group__progress">
                  <strong>{selected.length}/1 필수 · 최대 2개</strong>
                  <div><i style={{ width: `${(selected.length / 2) * 100}%` }} /></div>
                </div>
              </div>
              <div className={`preference-options preference-options--${group.options.length}`}>
                {group.options.map((option) => {
                  const isSelected = selected.includes(option.label)
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={isSelected ? 'is-selected' : ''}
                      key={option.label}
                      onClick={() => toggle(group.id, option.label)}
                      type="button"
                    >
                      <span className="choice-check">{isSelected && <Icon name="check" size={15} />}</span>
                      <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
                    </button>
                  )
                })}
              </div>
              {limitMessage === group.id && <p className="preference-limit" role="status">이 질문에서는 최대 2개까지 선택할 수 있어요.</p>}
            </fieldset>
          )
        })}
      </div>
      <div className="preference-actions">
        <button className="button button--primary preference-save" disabled={!ready} onClick={onSave} type="button">
          {saved ? '선호 조건 다시 저장하고 시작' : '선호 조건 저장하고 시작'}
          <Icon name="chevron" size={18} />
        </button>
        <p>저장한 선호 조건은 언제든지 <strong>내 정보</strong>에서 수정할 수 있어요.</p>
      </div>
    </div>
  )
}

function CargoRegistration({ cargo, onChange, onRegister }: { cargo: CargoForm; onChange: (cargo: CargoForm) => void; onRegister: () => void }) {
  const update = (key: keyof CargoForm, value: string) => onChange({ ...cargo, [key]: value })
  const completed = [cargo.origin, cargo.destination, cargo.vehicle, cargo.item, cargo.loadingDate, cargo.loadingTime].filter(Boolean).length
  return (
    <div className="screen-stack">
      <div className="preference-heading-row">
        <PageHeading title="콜 등록" description="배차에 필요한 화물 정보를 확인하고 상차 시간을 선택하세요." />
        <SectionProgress current={completed} label="콜 정보 진행률" total={6} />
      </div>
      <form className="call-form panel" onSubmit={(event) => { event.preventDefault(); onRegister() }}>
        <label><span>출발지</span><select value={cargo.origin} onChange={(event) => update('origin', event.target.value)}><option>안산</option><option>인천</option><option>화성</option></select></label>
        <label><span>도착지</span><select value={cargo.destination} onChange={(event) => update('destination', event.target.value)}><option>부산</option><option>울산</option><option>김해</option></select></label>
        <label><span>차량</span><select value={cargo.vehicle} onChange={(event) => update('vehicle', event.target.value)}><option>5톤 카고</option><option>11톤 윙바디</option><option>25톤 카고</option></select></label>
        <label><span>품목</span><input value={cargo.item} onChange={(event) => update('item', event.target.value)} /></label>
        <label><span>상차 날짜</span><input type="date" value={cargo.loadingDate} onChange={(event) => update('loadingDate', event.target.value)} /></label>
        <label><span>상차 시간</span><select value={cargo.loadingTime} onChange={(event) => update('loadingTime', event.target.value)}><option value="">미선택</option><option>06:00~12:00</option><option>12:00~18:00</option><option>18:00~06:00</option></select></label>
        <div className="call-form__summary"><Icon name="info" size={19} /><p>상차 시간을 선택하지 않으면 현재 배차 정보에 <strong>미선택</strong>으로 표시됩니다.</p></div>
        <button className="button button--primary" type="submit">콜 등록하고 실시간 배차 시작 <Icon name="chevron" size={18} /></button>
      </form>
    </div>
  )
}

function PredictionCard({ recommended = false }: { recommended?: boolean }) {
  return (
    <article className={`prediction-card${recommended ? ' prediction-card--recommended' : ''}`}>
      <header><strong>{recommended ? '상차를 하루 미루면' : '현재 조건'}</strong><span>{recommended ? '화~수 아무 때나' : '화요일 오전 (3시간)'}</span></header>
      <div className="prediction-value"><strong>{recommended ? '3,400' : '100'}</strong><span>수락가능 차주 {recommended && <em>▲ 34배</em>}</span></div>
      <div className="prediction-value prediction-value--small"><strong>{recommended ? '38만원' : '42만원'}</strong><span>예상 운임 {recommended && <em>▼ 4만원</em>}</span></div>
      <div className="prediction-value prediction-value--small"><strong>{recommended ? '약 15분' : '약 40분'}</strong><span>예상 배차 시간 {recommended && <em>▼ 25분</em>}</span></div>
    </article>
  )
}

function ConditionComparison({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="screen-stack">
      <div className="preference-heading-row">
        <PageHeading title="조건 비교" description="현재 조건과 유연 조건의 예상 배차 결과를 비교하세요." />
        <SectionProgress current={2} label="조건 비교 진행률" total={3} />
      </div>
      <div className="prediction-grid"><PredictionCard /><PredictionCard recommended /></div>
      <div className="evidence-box"><Icon name="info" size={20} /><p><strong>화요일 오전은 이 노선 수요 피크입니다.</strong><br />최근 90일 실거래 기준이며, 안전운임 고시를 준수한 범위입니다.</p></div>
      <div className="choice-actions">
        <button className="button button--choice button--ghost" onClick={onChoose} type="button">현재 조건 선택</button>
        <button className="button button--choice button--primary" onClick={onChoose} type="button">하루 열고 선택</button>
      </div>
      <p className="choice-note">조건 변경을 강요하지 않습니다. 어느 쪽을 선택해도 불이익이 없습니다.</p>
    </div>
  )
}

function CarbonReport() {
  const [showMethod, setShowMethod] = useState(false)
  return (
    <div className="screen-stack report-screen">
      <div className="preference-heading-row">
        <PageHeading title="월간 리포트" description="조건 개방이 만든 공차·비용·탄소 감축을 국내 공식계수로 확인하세요." />
        <SectionProgress current={3} label="리포트 집계" total={3} />
      </div>
      <section className="metric-strip report-metrics">
        <article><span>조건 개방 실현 감축</span><strong>673.5 tCO₂</strong><small>총 배출 대비 19.8%</small></article>
        <article><span>공차 감축거리</span><strong>1,290,097 km</strong><small>가상데이터 12,000건</small></article>
        <article><span>연료비 절감</span><strong>3억 8,791만원</strong><small>경유 1,503원/L 적용</small></article>
      </section>
      <section className="report-grid">
        <article className="panel emissions-panel">
          <div className="section-title-row"><div><span className="mono-label">EMISSIONS STRUCTURE</span><h2>전체 배출 구조</h2></div><span className="method-chip">TTW 기준</span></div>
          <div className="emissions-visual">
            <div className="donut" aria-label="총 배출량 3,398.5톤"><span><strong>3,398.5</strong><small>tCO₂</small></span></div>
            <div className="legend-list"><div><i className="legend-dot legend-dot--loaded"/><span>적재구간</span><strong>54.3%</strong></div><div><i className="legend-dot legend-dot--approach"/><span>접근 공차</span><strong>3.1%</strong></div><div><i className="legend-dot legend-dot--return"/><span>귀로 공차</span><strong>42.6%</strong></div></div>
          </div>
        </article>
        <article className="panel impact-panel">
          <span className="mono-label">MEASURED IMPACT</span><h2>공차를 줄인 만큼만 감축으로 계산</h2>
          <div className="impact-number"><Icon name="leaf" size={34} /><strong>673,543 kg</strong></div>
          <p>평균 시간창 264분을 반영해 잠재 감축량의 91%를 실제 개방 효과로 산정했습니다.</p>
          <div className="progress-track"><span style={{ width: '91%' }} /></div><small>방식 B 실현율 91%</small>
        </article>
      </section>
      <section className="panel route-panel">
        <div className="section-title-row"><div><span className="mono-label">ROUTE BREAKDOWN</span><h2>노선별 건당 감축량</h2></div><span className="unit-label">kg CO₂ / 건</span></div>
        <div className="route-bars">{routeReductions.map((item) => <div className="route-bar" key={item.route}><span>{item.route}</span><div><i style={{ width: `${item.width}%` }} /></div><strong>{item.value}</strong></div>)}</div>
      </section>
      <section className="panel method-panel">
        <button className="method-toggle" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)} type="button"><span><Icon name="leaf" /> 국내 공식계수와 산정 근거</span><Icon className={showMethod ? 'is-rotated' : ''} name="chevron" size={19} /></button>
        {showMethod && <div className="method-details"><div className="formula-box"><span>조건 완화 감축량</span><code>ΔE_B = d_R × EF공차(t) × (β_R − r_now) × (1 − w / 48h)</code><p>경유 2.609 kg CO₂/L(에너지법 별표12)을 톤급별 연비로 나눠 거리당 계수로 환산합니다.</p></div><div className="factor-table-wrap"><table><caption>톤급별 거리당 배출계수</caption><thead><tr><th>톤급</th><th>적재 kg/km</th><th>공차 kg/km</th></tr></thead><tbody>{emissionFactors.map((factor) => <tr key={factor.ton}><th>{factor.ton}</th><td>{factor.loaded}</td><td>{factor.empty}</td></tr>)}</tbody></table></div></div>}
      </section>
    </div>
  )
}

function ProfileScreen({ preferences, onEdit }: { preferences: PreferenceState; onEdit: () => void }) {
  const savedCount = Object.values(preferences).flat().length
  return (
    <div className="screen-stack">
      <div className="preference-heading-row">
        <PageHeading title="내 정보" description="계정 정보와 저장한 화주 선호 조건을 관리하세요." />
        <SectionProgress current={savedCount > 0 ? 2 : 1} label="프로필 설정" total={2} />
      </div>
      <section className="profile-overview panel">
        <div className="profile-overview__identity"><span className="avatar">화</span><div><small>화주·주선사 계정</small><h2>Mov!n 물류 운영팀</h2><p>operator@movin.kr</p></div></div>
        <dl><div><dt>사업자 유형</dt><dd>화주·주선사</dd></div><div><dt>알림 방식</dt><dd>실시간 화면 알림</dd></div><div><dt>연동 상태</dt><dd className="profile-live"><i /> 운송인 연동 중</dd></div></dl>
      </section>
      <section className="profile-preferences panel">
        <div className="section-title-row"><div><h2>화주 선호 조건</h2><p>콜 등록과 조건 비교에 기본값으로 반영됩니다.</p></div><button className="button button--ghost button--compact" onClick={onEdit} type="button">선호 조건 수정</button></div>
        <div className="saved-preferences">
          {preferenceGroups.map((group) => <div key={group.id}><strong>{group.title}</strong><span>{preferences[group.id].length ? preferences[group.id].join(' · ') : '미설정'}</span></div>)}
        </div>
      </section>
    </div>
  )
}

export function ShipperScreen({ section, onNavigate }: { section: ShipperSection; onNavigate: (section: ShipperSection) => void }) {
  const [cargo, setCargo] = useState<CargoForm>(initialCargo)
  const [preferences, setPreferences] = useState<PreferenceState>(loadSavedPreferences)
  const [stage, setStage] = useState<DispatchStage>(() => preferencesAreComplete(preferences) ? 'completed' : 'preference-waiting')
  const [saved, setSaved] = useState(() => preferencesAreComplete(preferences))
  const [toast, setToast] = useState('')
  const completedPreferenceGroups = useMemo(() => preferenceGroups.filter((group) => preferences[group.id].length > 0).length, [preferences])

  useEffect(() => {
    if (stage === 'carrier-waiting') {
      const timer = window.setTimeout(() => setStage('matching'), 1400)
      return () => window.clearTimeout(timer)
    }
    if (stage === 'matching') {
      const timer = window.setTimeout(() => setStage('completed'), 1900)
      return () => window.clearTimeout(timer)
    }
  }, [stage])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const updatePreference = (group: PreferenceGroupId, option: string) => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // The in-memory edit still works when browser storage is unavailable.
    }
    setSaved(false)
    setStage('preference-waiting')
    setPreferences((current) => {
      const selected = current[group]
      return { ...current, [group]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] }
    })
  }

  const savePreferences = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences))
    } catch {
      setToast('브라우저 저장소를 사용할 수 없어 이번 화면에서만 선호 조건을 유지합니다.')
    }
    setSaved(true)
    setStage('carrier-waiting')
    setToast((current) => current || '선호 조건이 저장되었습니다. 운송인 응답을 실시간으로 확인하고 있어요.')
  }

  const registerCargo = () => {
    setStage(saved ? 'carrier-waiting' : 'preference-waiting')
    setToast(saved ? '콜이 등록되었습니다. 운송인에게 조건을 전송했어요.' : '콜이 등록되었습니다. 필수 설정을 완료하면 배차가 시작돼요.')
  }

  const sectionContent = section === 'preferences'
    ? <PreferenceSettings onChange={updatePreference} onSave={savePreferences} preferences={preferences} saved={saved} />
    : section === 'register'
      ? <CargoRegistration cargo={cargo} onChange={setCargo} onRegister={registerCargo} />
      : section === 'compare'
        ? <ConditionComparison onChoose={() => { setStage('carrier-waiting'); setToast('선택한 조건이 운송인에게 전달되었습니다.') }} />
        : section === 'report'
          ? <CarbonReport />
          : <ProfileScreen onEdit={() => onNavigate('preferences')} preferences={preferences} />

  return (
    <div className="shipper-workspace">
      <div className="live-summary-heading">
        <div><h1>실시간 배차 요약</h1><span><i /> 라이브</span></div>
        <p>화주 조건과 운송인 응답이 같은 배차 흐름에 바로 반영됩니다.</p>
      </div>
      <RouteSelector cargo={cargo} onChange={setCargo} />
      <LiveStatusSummary completedPreferenceGroups={completedPreferenceGroups} stage={stage} />
      <div className="shipper-content-grid">
        <div className="shipper-tab-content">
          {sectionContent}
          <CurrentDispatchInfo cargo={cargo} preferences={preferences} stage={stage} />
        </div>
        <DecisionSummary cargo={cargo} completedPreferenceGroups={completedPreferenceGroups} stage={stage} />
      </div>
      {toast && <div className="registration-result" role="status"><span className="result-icon"><Icon name="check" /></span><span><strong>실시간 배차 상태가 갱신됐어요.</strong><small>{toast}</small></span><button aria-label="알림 닫기" onClick={() => setToast('')} type="button">×</button></div>}
    </div>
  )
}
