import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { emissionFactors, routeReductions } from '../../data'

export type ShipperSection = 'dashboard' | 'register' | 'compare' | 'report' | 'chat'

type CargoForm = {
  origin: string
  destination: string
  cargo: string
  schedule: string
}

const initialCargo: CargoForm = {
  origin: '안산',
  destination: '부산',
  cargo: '5톤 카고 · 파렛트 12',
  schedule: '10/14(화) 09:00 ~ 12:00',
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
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

function DashboardOverview({ onNavigate }: { onNavigate: (section: ShipperSection) => void }) {
  return (
    <div className="screen-stack">
      <PageHeading title="대시보드" description="조건을 여는 순간, 달라지는 배차 결과를 먼저 확인하세요." />
      <section className="hero-panel dashboard-hero">
        <div>
          <h2>조건이 가격을 만듭니다</h2>
          <p>정해진 조건으로 기사를 찾기 전에, 조건별 예상 운임과 배차 속도를 먼저 비교합니다.</p>
        </div>
        <button className="button button--primary" onClick={() => onNavigate('register')} type="button">
          새 화물 등록
          <Icon name="chevron" size={18} />
        </button>
      </section>
      <section className="metric-strip" aria-label="핵심 분석 지표">
        <article>
          <span>분석 데이터</span>
          <strong>12,000건</strong>
          <small>가상 운송 데이터 기준</small>
        </article>
        <article>
          <span>조건 개방 실현 감축</span>
          <strong>19.8%</strong>
          <small>국내 공식 연료계수 적용</small>
        </article>
        <article>
          <span>현재 복화율</span>
          <strong>1.6%</strong>
          <small>36시간 내 권역 연결 기준</small>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel action-panel">
          <div className="section-title-row">
            <div>
              <span className="mono-label">ACTION REQUIRED</span>
              <h2>조건 비교가 필요한 콜</h2>
            </div>
            <span className="count-badge">1</span>
          </div>
          <button className="action-row" onClick={() => onNavigate('compare')} type="button">
            <span className="icon-box"><Icon name="compare" /></span>
            <span>
              <strong>안산 → 부산 · 5톤 카고</strong>
              <small>화요일 오전 조건을 하루 열면 예상 운임 4만원 절감</small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        </article>
        <article className="panel principle-panel">
          <Icon name="shield" size={30} />
          <h2>결정권은 사용자에게</h2>
          <p>조건 변경을 강요하지 않습니다. 수락과 거절 모두 다음 예측을 정교하게 만드는 데이터가 됩니다.</p>
        </article>
      </section>
    </div>
  )
}

function CargoEditor({ value, onSave, onCancel }: { value: CargoForm; onSave: (value: CargoForm) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <form
      className="cargo-editor"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <label>
        출발지
        <input value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} />
      </label>
      <label>
        도착지
        <input value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} />
      </label>
      <label>
        화물·차종
        <input value={draft.cargo} onChange={(event) => setDraft({ ...draft, cargo: event.target.value })} />
      </label>
      <label>
        상차 희망 시간
        <input value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value })} />
      </label>
      <div className="editor-actions">
        <button className="button button--ghost" onClick={onCancel} type="button">취소</button>
        <button className="button button--dark" type="submit">조건 저장</button>
      </div>
    </form>
  )
}

function PredictionCard({ recommended = false }: { recommended?: boolean }) {
  return (
    <article className={`prediction-card${recommended ? ' prediction-card--recommended' : ''}`}>
      <header>
        <strong>{recommended ? '상차를 하루 미루면' : '현재 조건'}</strong>
        <span>{recommended ? '화~수 아무 때나' : '화요일 오전 (3시간)'}</span>
      </header>
      <div className="prediction-value">
        <strong>{recommended ? '3,400' : '100'}</strong>
        <span>수락가능 차주 {recommended && <em>▲ 34배</em>}</span>
      </div>
      <div className="prediction-value prediction-value--small">
        <strong>{recommended ? '38만원' : '42만원'}</strong>
        <span>예상 운임 {recommended && <em>▼ 4만원</em>}</span>
      </div>
      <div className="prediction-value prediction-value--small">
        <strong>{recommended ? '약 15분' : '약 40분'}</strong>
        <span>예상 배차 시간 {recommended && <em>▼ 25분</em>}</span>
      </div>
    </article>
  )
}

function EffectsRail() {
  const effects = [
    { icon: 'users' as const, label: '수락가능 차주 증가', value: '▲ 34배' },
    { icon: 'wallet' as const, label: '예상 운임 절감', value: '▼ 4만원' },
    { icon: 'clock' as const, label: '예상 배차 단축', value: '▼ 25분' },
  ]
  return (
    <aside className="effects-rail panel">
      <h2>예상 효과</h2>
      <div className="effects-list">
        {effects.map((effect) => (
          <div className="effect-row" key={effect.label}>
            <span className="effect-icon"><Icon name={effect.icon} /></span>
            <span><small>{effect.label}</small><strong>{effect.value}</strong></span>
          </div>
        ))}
      </div>
      <div className="confidence">
        <span>예측 신뢰도 <Icon name="info" size={15} /></span>
        <div className="confidence-ring"><strong>78%</strong></div>
        <small>최근 90일 동일 노선 실거래 기준</small>
      </div>
    </aside>
  )
}

function ConditionWorkspace({ focusComparison = false }: { focusComparison?: boolean }) {
  const [cargo, setCargo] = useState(initialCargo)
  const [editing, setEditing] = useState(false)
  const [registeredChoice, setRegisteredChoice] = useState<'current' | 'flexible' | null>(null)
  const comparisonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusComparison) comparisonRef.current?.focus({ preventScroll: false })
  }, [focusComparison])

  return (
    <div className="condition-layout">
      <div className="screen-stack">
        <PageHeading title="화물 정보 등록" description="추가 질문 없이, 입력한 조건의 차이를 바로 보여드립니다." />
        <section className="panel entered-cargo">
          <div className="entered-cargo__header">
            <span className="section-kicker">입력한 조건</span>
            {!editing && <button className="button button--compact button--ghost" onClick={() => setEditing(true)} type="button">수정</button>}
          </div>
          {editing ? (
            <CargoEditor value={cargo} onCancel={() => setEditing(false)} onSave={(value) => { setCargo(value); setEditing(false) }} />
          ) : (
            <div className="cargo-summary">
              <h2>{cargo.origin} <span>→</span> {cargo.destination}</h2>
              <p>{cargo.cargo}</p>
              <p className="schedule-line"><Icon name="calendar" size={18} /> {cargo.schedule}</p>
            </div>
          )}
        </section>
        <div className="comparison-section" ref={comparisonRef} tabIndex={-1}>
          <div className="analysis-label"><Icon name="spark" size={16} /> AI 분석 결과</div>
          <div className="prediction-grid">
            <PredictionCard />
            <PredictionCard recommended />
          </div>
          <div className="evidence-box">
            <Icon name="info" size={20} />
            <p><strong>화요일 오전은 이 노선 수요 피크입니다.</strong><br />최근 90일 실거래 기준이며, 안전운임 고시를 준수한 범위입니다.</p>
          </div>
          <div className="choice-actions">
            <button className="button button--choice button--ghost" onClick={() => setRegisteredChoice('current')} type="button">현재 조건으로 등록</button>
            <button className="button button--choice button--primary" onClick={() => setRegisteredChoice('flexible')} type="button">하루 열고 등록</button>
          </div>
          <p className="choice-note">조건 변경을 강요하지 않습니다. 어느 쪽을 선택해도 불이익이 없습니다.</p>
        </div>
        {registeredChoice && (
          <div className="registration-result" role="status">
            <span className="result-icon"><Icon name="check" /></span>
            <span>
              <strong>화물 등록이 완료되었습니다.</strong>
              <small>{registeredChoice === 'flexible' ? '화~수 시간창으로 열어 배차를 시작합니다.' : '입력한 화요일 오전 조건으로 배차를 시작합니다.'}</small>
            </span>
            <button aria-label="등록 완료 알림 닫기" onClick={() => setRegisteredChoice(null)} type="button">×</button>
          </div>
        )}
      </div>
      <EffectsRail />
    </div>
  )
}

function CarbonReport() {
  const [showMethod, setShowMethod] = useState(false)
  return (
    <div className="screen-stack report-screen">
      <PageHeading
        title="월간 리포트"
        description="조건 개방이 만든 공차·비용·탄소 감축을 국내 공식계수로 확인하세요."
        action={<button className="button button--primary" onClick={() => window.print()} type="button">리포트 인쇄 / PDF</button>}
      />
      <section className="metric-strip report-metrics">
        <article><span>조건 개방 실현 감축</span><strong>673.5 tCO₂</strong><small>총 배출 대비 19.8%</small></article>
        <article><span>공차 감축거리</span><strong>1,290,097 km</strong><small>가상데이터 12,000건</small></article>
        <article><span>연료비 절감</span><strong>3억 8,791만원</strong><small>경유 1,503원/L 적용</small></article>
      </section>
      <section className="report-grid">
        <article className="panel emissions-panel">
          <div className="section-title-row">
            <div><span className="mono-label">EMISSIONS STRUCTURE</span><h2>전체 배출 구조</h2></div>
            <span className="method-chip">TTW 기준</span>
          </div>
          <div className="emissions-visual">
            <div className="donut" aria-label="총 배출량 3,398.5톤"><span><strong>3,398.5</strong><small>tCO₂</small></span></div>
            <div className="legend-list">
              <div><i className="legend-dot legend-dot--loaded"/><span>적재구간</span><strong>54.3%</strong></div>
              <div><i className="legend-dot legend-dot--approach"/><span>접근 공차</span><strong>3.1%</strong></div>
              <div><i className="legend-dot legend-dot--return"/><span>귀로 공차</span><strong>42.6%</strong></div>
            </div>
          </div>
        </article>
        <article className="panel impact-panel">
          <span className="mono-label">MEASURED IMPACT</span>
          <h2>공차를 줄인 만큼만 감축으로 계산</h2>
          <div className="impact-number"><Icon name="leaf" size={34} /><strong>673,543 kg</strong></div>
          <p>평균 시간창 264분을 반영해 잠재 감축량의 91%를 실제 개방 효과로 산정했습니다.</p>
          <div className="progress-track"><span style={{ width: '91%' }} /></div>
          <small>방식 B 실현율 91%</small>
        </article>
      </section>
      <section className="panel route-panel">
        <div className="section-title-row">
          <div><span className="mono-label">ROUTE BREAKDOWN</span><h2>노선별 건당 감축량</h2></div>
          <span className="unit-label">kg CO₂ / 건</span>
        </div>
        <div className="route-bars">
          {routeReductions.map((item) => (
            <div className="route-bar" key={item.route}>
              <span>{item.route}</span>
              <div><i style={{ width: `${item.width}%` }} /></div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel method-panel">
        <button className="method-toggle" aria-expanded={showMethod} onClick={() => setShowMethod((value) => !value)} type="button">
          <span><Icon name="leaf" /> 국내 공식계수와 산정 근거</span>
          <Icon className={showMethod ? 'is-rotated' : ''} name="chevron" size={19} />
        </button>
        {showMethod && (
          <div className="method-details">
            <div className="formula-box">
              <span>조건 완화 감축량</span>
              <code>ΔE_B = d_R × EF공차(t) × (β_R − r_now) × (1 − w / 48h)</code>
              <p>경유 2.609 kg CO₂/L(에너지법 별표12)을 톤급별 연비로 나눠 거리당 계수로 환산합니다.</p>
            </div>
            <div className="factor-table-wrap">
              <table>
                <caption>톤급별 거리당 배출계수</caption>
                <thead><tr><th>톤급</th><th>적재 kg/km</th><th>공차 kg/km</th></tr></thead>
                <tbody>{emissionFactors.map((factor) => <tr key={factor.ton}><th>{factor.ton}</th><td>{factor.loaded}</td><td>{factor.empty}</td></tr>)}</tbody>
              </table>
              <div className="assumption-note"><Icon name="info" size={18} /><p><strong>연료계수는 공식, 연비는 가정입니다.</strong><br />실서비스에서는 차량별 실연비·실연료 데이터로 교체합니다.</p></div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function ChatScreen() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<{ sender: 'user' | 'system'; text: string }[]>([
    { sender: 'system', text: '안녕하세요. 현재 안산→부산 콜의 수요 피크와 예측 범위를 설명해 드릴 수 있어요.' },
  ])
  const sendQuestion = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const reply = trimmed.includes('불이익')
      ? '조건을 바꾸지 않아도 불이익은 없습니다. 수락과 거절 모두 다음 예측의 근거로만 사용됩니다.'
      : trimmed.includes('안전운임')
        ? '최근 90일 실거래 분포를 사용하되, 안전운임 고시를 준수하는 범위 안에서만 결과를 제시합니다.'
        : '예측 신뢰도 78%는 동일 노선·시간대의 최근 데이터가 충분하다는 뜻입니다. 점 추정이 아닌 범위와 함께 판단해 주세요.'
    setMessages((current) => [...current, { sender: 'user', text: trimmed }, { sender: 'system', text: reply }])
    setQuestion('')
  }
  return (
    <div className="screen-stack chat-screen">
      <PageHeading title="도움말 · 채팅" description="예측 결과를 이해하는 데 필요한 근거만 간단히 확인하세요." />
      <section className="panel chat-window">
        <div className="chat-transcript" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`chat-message chat-message--${message.sender}`} key={`${message.sender}-${index}`}>
              {message.sender === 'system' && <span className="chat-avatar"><Icon name="spark" size={18} /></span>}
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <div className="suggested-questions">
          <button onClick={() => sendQuestion('예측 신뢰도 78%는 무슨 뜻인가요?')} type="button">예측 신뢰도 78%는 무슨 뜻인가요?</button>
          <button onClick={() => sendQuestion('안전운임을 어떻게 반영했나요?')} type="button">안전운임을 어떻게 반영했나요?</button>
          <button onClick={() => sendQuestion('조건을 바꾸지 않으면 불이익이 있나요?')} type="button">조건을 바꾸지 않으면 불이익이 있나요?</button>
        </div>
        <form className="chat-input" onSubmit={(event) => { event.preventDefault(); sendQuestion(question) }}>
          <label className="sr-only" htmlFor="chat-question">질문 입력</label>
          <input id="chat-question" onChange={(event) => setQuestion(event.target.value)} placeholder="궁금한 점을 입력하세요" value={question} />
          <button className="button button--dark" type="submit">보내기</button>
        </form>
      </section>
    </div>
  )
}

export function ShipperScreen({ section, onNavigate }: { section: ShipperSection; onNavigate: (section: ShipperSection) => void }) {
  if (section === 'dashboard') return <DashboardOverview onNavigate={onNavigate} />
  if (section === 'report') return <CarbonReport />
  if (section === 'chat') return <ChatScreen />
  return <ConditionWorkspace focusComparison={section === 'compare'} />
}
