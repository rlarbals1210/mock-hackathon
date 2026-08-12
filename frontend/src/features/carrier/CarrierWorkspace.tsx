import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { candidates } from '../../data'

type CarrierTab = 'home' | 'calls' | 'drive' | 'performance' | 'profile'

const tabItems: { id: CarrierTab; label: string; icon: IconName }[] = [
  { id: 'home', label: '홈', icon: 'dashboard' },
  { id: 'calls', label: '다음 콜', icon: 'truck' },
  { id: 'drive', label: '운행', icon: 'route' },
  { id: 'performance', label: '성과', icon: 'chart' },
  { id: 'profile', label: '프로필', icon: 'profile' },
]

function CarrierHome({ onOpenCalls }: { onOpenCalls: () => void }) {
  return (
    <div className="carrier-scroll carrier-home">
      <section className="carrier-route-card">
        <div className="carrier-card-head"><span className="mono-label">ACTIVE ROUTE</span><span className="yellow-status">운행 중</span></div>
        <div className="route-points">
          <div><i/><span><small>상차</small><strong>부산신항</strong></span></div>
          <div><i/><span><small>하차</small><strong>서울 강서 물류센터</strong></span></div>
        </div>
      </section>
      <section className="carrier-brief-card">
        <span className="brief-icon"><Icon name="clock" /></span>
        <div><strong>15:20 도착 예정</strong><p>이 하차지는 평균 1시간 30분 대기합니다.</p></div>
      </section>
      <div className="carrier-quick-grid">
        <article><Icon name="wallet"/><strong>38.2만원</strong><span>예상 실수령</span></article>
        <article><Icon name="route"/><strong>12km</strong><span>예상 공차</span></article>
      </div>
      <button className="button button--primary carrier-wide-button" onClick={onOpenCalls} type="button">다음 콜 후보 확인</button>
    </div>
  )
}

function CandidateComparison() {
  const [selected, setSelected] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const selectedCandidate = candidates.find((candidate) => candidate.id === selected) ?? candidates[0]
  return (
    <div className="carrier-scroll candidate-screen">
      <section className="safety-brief">
        <span><Icon name="shield" size={25} /></span>
        <div><strong>정차가 확인됐습니다</strong><p>하차지 15:20 도착 예정 · 평균 대기 1시간 30분</p></div>
      </section>
      <h2>다음 콜 후보 3건</h2>
      <div className="candidate-list" role="radiogroup" aria-label="다음 콜 후보">
        {candidates.map((candidate) => {
          const isSelected = candidate.id === selected
          return (
            <button
              aria-checked={isSelected}
              className={`candidate-card${isSelected ? ' is-selected' : ''}`}
              key={candidate.id}
              onClick={() => { setSelected(candidate.id); setConfirmed(false) }}
              role="radio"
              type="button"
            >
              <span className="radio-mark">{isSelected && <i />}</span>
              <span className="candidate-main">
                <strong>{candidate.id}. {candidate.route}</strong>
                <small>{candidate.time} · 공차 {candidate.emptyKm}km · {candidate.duration}시간</small>
                <span className="candidate-tags">
                  {candidate.warning && <em className="warning-tag">△ {candidate.warning}</em>}
                  {candidate.tags.map((tag) => <em key={tag}>{tag}</em>)}
                </span>
              </span>
              <span className="candidate-costs">
                <span><small>운임</small><b>{candidate.fare}만원</b></span>
                <span><small>유류</small><b>{candidate.fuelCost}만</b></span>
                <span><small>공차</small><b>{candidate.emptyCost.toFixed(1)}만</b></span>
                <span className="net-line"><small>실수령</small><b>{candidate.net}만원</b></span>
              </span>
              {isSelected && <span className="recommendation-label">추천</span>}
            </button>
          )
        })}
      </div>
      <button className="button button--primary carrier-wide-button" onClick={() => setConfirmed(true)} type="button">이 콜 선택하기</button>
      <p className="carrier-choice-note"><Icon name="info" size={17}/> 최종 선택은 운송인에게 있습니다</p>
      {confirmed && (
        <div className="carrier-confirmation" role="status">
          <Icon name="check" />
          <span><strong>{selectedCandidate.route}</strong><small>콜을 선택했습니다. 배차 확정을 확인해 주세요.</small></span>
          <button aria-label="선택 완료 알림 닫기" onClick={() => setConfirmed(false)} type="button">×</button>
        </div>
      )}
    </div>
  )
}

function DriveScreen() {
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading"><span className="icon-box icon-box--yellow"><Icon name="route" /></span><div><h2>운행 브리핑</h2><p>운전 중에는 판단을 요구하지 않습니다.</p></div></div>
      <section className="carrier-route-card">
        <div className="carrier-card-head"><span className="mono-label">CURRENT TRIP</span><span className="yellow-status">65% 완료</span></div>
        <div className="route-progress"><span style={{ width: '65%' }} /></div>
        <div className="route-points route-points--compact">
          <div><i/><span><small>출발 완료 · 08:30</small><strong>부산신항</strong></span></div>
          <div><i/><span><small>도착 예정 · 15:20</small><strong>서울 강서 물류센터</strong></span></div>
        </div>
      </section>
      <section className="carrier-brief-card"><span className="brief-icon"><Icon name="shield" /></span><div><strong>안전 우선</strong><p>다음 콜 상세 비교는 정차가 확인된 뒤 열립니다.</p></div></section>
    </div>
  )
}

function PerformanceScreen() {
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading"><span className="icon-box icon-box--yellow"><Icon name="chart" /></span><div><h2>이번 달 성과</h2><p>성과를 먼저, 개선은 그다음에 보여드립니다.</p></div></div>
      <section className="performance-hero">
        <Icon name="leaf" size={35} />
        <span>복화 연결로 줄인 공차</span>
        <strong>1,200km</strong>
        <p>약 47만원을 아꼈습니다.</p>
      </section>
      <div className="carrier-quick-grid">
        <article><Icon name="leaf"/><strong>57.1kg</strong><span>CO₂ 감축</span></article>
        <article><Icon name="wallet"/><strong>32,902원</strong><span>연료비 절감</span></article>
      </div>
    </div>
  )
}

function ProfileScreen() {
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="profile-header-card"><span className="avatar avatar--large">김</span><div><h2>김무빈 운송인</h2><p>11톤 윙바디 · 부산 82가 4201</p></div></div>
      <section className="preference-list">
        <h3>선호 조건</h3>
        <div><span>주요 노선</span><strong>부산 ↔ 수도권</strong></div>
        <div><span>선호 시간</span><strong>오후 상차</strong></div>
        <div><span>귀가 희망</span><strong>금요일 부산</strong></div>
      </section>
      <p className="preference-note"><Icon name="info" size={17}/> 명시한 선호보다 실제 선택 이력을 더 정확한 신호로 반영합니다.</p>
    </div>
  )
}

function CarrierStageRail() {
  return (
    <aside className="carrier-stage-rail">
      <span className="mono-label">TODAY'S ROUTE</span>
      <h2>운송 단계</h2>
      <div className="stage-list">
        <div className="is-complete"><span><Icon name="check" size={16}/></span><p><strong>배차 완료</strong><small>08:30</small></p></div>
        <div className="is-active"><span><Icon name="truck" size={17}/></span><p><strong>운행 중</strong><small>15:20 도착 예정</small></p></div>
        <div><span><Icon name="location" size={16}/></span><p><strong>하차</strong><small>대기</small></p></div>
      </div>
      <div className="rail-principle"><Icon name="shield"/><p>정차 시에만 상세 비교를 열어 안전한 선택을 돕습니다.</p></div>
    </aside>
  )
}

export function CarrierWorkspace({ onReturnToShipper }: { onReturnToShipper: () => void }) {
  const [tab, setTab] = useState<CarrierTab>('calls')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  return (
    <div className="carrier-page">
      <CarrierStageRail />
      <div className="carrier-phone">
        <header className="carrier-header">
          <h1>Mov!n <span>Carrier</span></h1>
          <div>
            <button aria-label="화주·주선사 화면으로 전환" onClick={onReturnToShipper} type="button"><Icon name="switch" /></button>
            <button aria-expanded={notificationsOpen} aria-label="알림" onClick={() => setNotificationsOpen((value) => !value)} type="button"><Icon name="bell" /></button>
          </div>
        </header>
        {notificationsOpen && <div className="carrier-notification" role="status"><strong>새 알림이 없습니다.</strong><span>정차 후 다음 콜이 열리면 알려드려요.</span></div>}
        <div className="carrier-content">
          {tab === 'home' && <CarrierHome onOpenCalls={() => setTab('calls')} />}
          {tab === 'calls' && <CandidateComparison />}
          {tab === 'drive' && <DriveScreen />}
          {tab === 'performance' && <PerformanceScreen />}
          {tab === 'profile' && <ProfileScreen />}
        </div>
        <nav className="carrier-bottom-nav" aria-label="운송인 메뉴">
          {tabItems.map((item) => (
            <button className={tab === item.id ? 'is-active' : ''} key={item.id} onClick={() => setTab(item.id)} type="button">
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {tab === item.id && <i />}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
