import { useEffect, useState } from 'react'
import { CustomOverlayMap, Map, MapMarker, Polyline, useKakaoLoader } from 'react-kakao-maps-sdk'
import { Icon } from '../../components/Icon'
import { backhaulOffers, candidates, cityCoords, orders, virtualCarrierProfile, type BackhaulOffer, type Candidate } from '../../data'
import { carrierStageLabels, type CarrierStage, type NotificationKind } from './flow'

function routeEndpoints(route: string) {
  const [originLabel, destinationLabel] = route.split('→').map((part) => part.trim())
  return { originLabel, destinationLabel, origin: cityCoords[originLabel], destination: cityCoords[destinationLabel] }
}

function PreferenceChipGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string | null; onSelect: (value: string) => void }) {
  return (
    <section className="preference-list">
      <h3>{label}</h3>
      <div className="carrier-chip-row">
        {options.map((option) => (
          <button
            aria-pressed={option === selected}
            className={`carrier-chip${option === selected ? ' is-selected' : ''}`}
            key={option}
            onClick={() => onSelect(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  )
}

function PreferenceMultiChipGroup({ label, options, selected, onToggle }: { label: string; options: { value: string; sub?: string }[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <section className="preference-list">
      <h3>{label}</h3>
      <div className="carrier-chip-row">
        {options.map((option) => (
          <button
            aria-pressed={selected.includes(option.value)}
            className={`carrier-chip${selected.includes(option.value) ? ' is-selected' : ''}`}
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.value}
            {option.sub && <small className="carrier-chip-sub">{option.sub}</small>}
          </button>
        ))}
      </div>
    </section>
  )
}

export type CarrierPreferences = { region: string; subRegion: string; time: string[]; priorities: string[] }

// ai/generate_data.py의 REGIONS(권역)와 실제 행정구역 하위 지역을 매핑
const regionOptions = ['영남', '수도권', '충청', '호남', '강원제주']
const subRegionsByRegion: Record<string, string[]> = {
  영남: ['부산', '대구', '울산', '경남', '경북'],
  수도권: ['서울', '경기', '인천'],
  충청: ['대전', '세종', '충남', '충북'],
  호남: ['광주', '전남', '전북'],
  강원제주: ['강원', '제주'],
}
const timeOptions: { value: string; sub?: string }[] = [
  { value: '오전 상차', sub: '06:00~12:00' },
  { value: '오후 상차', sub: '12:00~18:00' },
  { value: '야간 상차', sub: '18:00~24:00' },
  { value: '상관없음' },
]
const priorityOptions: { value: string }[] = [
  { value: '많은 수익' },
  { value: '공차 30km 이내' },
  { value: '8시간 이내의 거리' },
  { value: '복화 가능성' },
]

function toggleTimeSelection(current: string[], value: string) {
  if (value === '상관없음') return current.includes('상관없음') ? [] : ['상관없음']
  const withoutExclusive = current.filter((entry) => entry !== '상관없음')
  return withoutExclusive.includes(value)
    ? withoutExclusive.filter((entry) => entry !== value)
    : [...withoutExclusive, value]
}

function toggleInList(current: string[], value: string) {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
}

function BaseProfileScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="truck" /></span>
        <div><h2>내 기본 조건</h2><p>가입 시 등록된 차량 정보예요.</p></div>
      </div>
      <div className="profile-header-card">
        <span className="avatar avatar--large">{virtualCarrierProfile.name[0]}</span>
        <div><h2>{virtualCarrierProfile.name} 운송인</h2><p>{virtualCarrierProfile.vehicleType}</p></div>
      </div>
      <section className="preference-list">
        <h3>차량 정보</h3>
        <div><span>톤급</span><strong>{virtualCarrierProfile.tonnage}톤</strong></div>
        <div><span>적재 형태</span><strong>{virtualCarrierProfile.form}</strong></div>
        <div><span>기반 지역</span><strong>{virtualCarrierProfile.baseRegion}</strong></div>
      </section>
      <button className="button button--primary carrier-wide-button" onClick={onNext} type="button">확인했어요</button>
    </div>
  )
}

function PreferenceSetupScreen({ onNext }: { onNext: (preferences: CarrierPreferences) => void }) {
  const [region, setRegion] = useState<string | null>(null)
  const [subRegion, setSubRegion] = useState<string | null>(null)
  const [time, setTime] = useState<string[]>([])
  const [priorities, setPriorities] = useState<string[]>([])

  const subRegionOptions = region ? subRegionsByRegion[region] : []
  const canProceed = Boolean(region && subRegion && time.length > 0 && priorities.length > 0)

  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="shield" /></span>
        <div><h2>선호 조건 설정</h2><p>운행 전에 선호 조건을 알려주시면 더 정확한 콜을 추천해 드려요.</p></div>
      </div>
      <PreferenceChipGroup
        label="선호 지역"
        onSelect={(value) => {
          setRegion(value)
          setSubRegion(null)
        }}
        options={regionOptions}
        selected={region}
      />
      {region && (
        <PreferenceChipGroup label={`${region} 세부 지역`} onSelect={setSubRegion} options={subRegionOptions} selected={subRegion} />
      )}
      <PreferenceMultiChipGroup
        label="선호 시간 (복수 선택 가능)"
        onToggle={(value) => setTime((current) => toggleTimeSelection(current, value))}
        options={timeOptions}
        selected={time}
      />
      <PreferenceMultiChipGroup
        label="운행조건에서 중요해요"
        onToggle={(value) => setPriorities((current) => toggleInList(current, value))}
        options={priorityOptions}
        selected={priorities}
      />
      <button
        className="button button--primary carrier-wide-button"
        disabled={!canProceed}
        onClick={() => {
          if (!region || !subRegion) return
          onNext({ region, subRegion, time, priorities })
        }}
        type="button"
      >
        저장하고 시작하기
      </button>
      {!canProceed && <p className="carrier-choice-note"><Icon name="info" size={17} /> 모든 항목을 하나 이상 선택해주세요</p>}
    </div>
  )
}

function OrderBoardScreen({ scanning, preferences }: { scanning: boolean; preferences: CarrierPreferences | null }) {
  const preferredOrigin = preferences?.subRegion ?? null
  return (
    <div className="carrier-scroll carrier-home">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="dashboard" /></span>
        <div><h2>오더 게시판</h2><p>지금 열려 있는 화주 오더입니다.</p></div>
      </div>
      {scanning && (
        <div className="carrier-scanning" role="status">
          <i /> AI가 선호 조건에 맞는 콜을 찾는 중이에요
        </div>
      )}
      <div className="order-list">
        {orders.map((order) => {
          const matchesPreference = preferredOrigin ? order.route.startsWith(preferredOrigin) : false
          return (
            <article className={`order-card${matchesPreference ? ' is-preferred' : ''}`} key={order.id}>
              <div className="order-card-head">
                <strong>{order.route}</strong>
                <b>{order.price}만원</b>
              </div>
              <small>{order.cargo} · {order.weight} · {order.loadTime} · {order.distance}km</small>
              {matchesPreference && <span className="candidate-tags"><em>선호 지역</em></span>}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function compareCandidates(target: Candidate, baseline: Candidate) {
  const targetCost = target.fuelCost + target.emptyCost
  const baselineCost = baseline.fuelCost + baseline.emptyCost
  return {
    costDiff: targetCost - baselineCost,
    durationDiff: target.duration - baseline.duration,
    fareDiff: target.fare - baseline.fare,
    netDiff: target.net - baseline.net,
    emptyKmDiff: target.emptyKm - baseline.emptyKm,
    hourlyNetDiff: target.net / target.duration - baseline.net / baseline.duration,
  }
}

// 규칙 기반 템플릿. Gemini API 키 연동 후에는 diff 값을 넘겨 자연어 요약으로 교체.
function buildComparisonSummary(diff: ReturnType<typeof compareCandidates>) {
  const fareText = diff.fareDiff === 0
    ? '운임은 1순위와 같고'
    : `운임은 ${Math.abs(diff.fareDiff).toFixed(1)}만원 ${diff.fareDiff > 0 ? '높지만' : '낮고'}`
  const netText = diff.netDiff === 0
    ? '순수익도 같습니다'
    : `순수익은 ${Math.abs(diff.netDiff).toFixed(1)}만원 ${diff.netDiff > 0 ? '더 많습니다' : '적습니다'}`
  const durationText = diff.durationDiff === 0
    ? '운행시간은 1순위와 같습니다'
    : `운행시간은 ${Math.abs(diff.durationDiff)}시간 ${diff.durationDiff > 0 ? '더 걸립니다' : '덜 걸립니다'}`
  return `1순위 대비 ${fareText}, ${netText}. ${durationText}.`
}

function formatDiff(value: number, unit: string, decimals: number) {
  if (Math.abs(value) < 0.05) return `±0${unit}`
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}${unit}`
}

function CandidateComparisonPanel({ candidate, baseline }: { candidate: Candidate; baseline: Candidate }) {
  const diff = compareCandidates(candidate, baseline)
  const rows: { label: string; value: number; unit: string; decimals: number; emphasis?: boolean }[] = [
    { label: '운행비', value: diff.costDiff, unit: '만원', decimals: 1 },
    { label: '운행시간', value: diff.durationDiff, unit: '시간', decimals: 0 },
    { label: '표면운임', value: diff.fareDiff, unit: '만원', decimals: 1 },
    { label: '순수익', value: diff.netDiff, unit: '만원', decimals: 1, emphasis: true },
    { label: '공차거리', value: diff.emptyKmDiff, unit: 'km', decimals: 0 },
    { label: '시간당 순수익', value: diff.hourlyNetDiff, unit: '만원/시간', decimals: 1 },
  ]
  return (
    <section aria-live="polite" className="candidate-compare">
      <div className="candidate-compare-head">
        <Icon name="compare" size={18} />
        <strong>1순위 대비 비교</strong>
      </div>
      <div className="candidate-compare-grid">
        {rows.map((row) => (
          <div className={`compare-row${row.emphasis ? ' is-emphasis' : ''}`} key={row.label}>
            <small>{row.label}</small>
            <b className={row.value > 0.05 ? 'is-up' : row.value < -0.05 ? 'is-down' : ''}>
              {formatDiff(row.value, row.unit, row.decimals)}
            </b>
          </div>
        ))}
      </div>
      <p className="candidate-compare-summary">{buildComparisonSummary(diff)}</p>
    </section>
  )
}

function CandidateSelectScreen({ onConfirm }: { onConfirm: (candidate: Candidate) => void }) {
  const [selected, setSelected] = useState(1)
  const recommendedCandidate = candidates[0]
  const selectedCandidate = candidates.find((candidate) => candidate.id === selected) ?? recommendedCandidate
  const isComparingAlternative = selectedCandidate.id !== recommendedCandidate.id
  return (
    <div className="carrier-scroll candidate-screen">
      <section className="safety-brief">
        <span><Icon name="shield" size={25} /></span>
        <div><strong>AI 추천 후보가 도착했습니다</strong><p>조건에 맞는 콜 3건을 비교해 보세요</p></div>
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
              onClick={() => setSelected(candidate.id)}
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
              {candidate.id === recommendedCandidate.id && <span className="recommendation-label">추천</span>}
            </button>
          )
        })}
      </div>
      {isComparingAlternative && <CandidateComparisonPanel baseline={recommendedCandidate} candidate={selectedCandidate} />}
      <button className="button button--primary carrier-wide-button" onClick={() => onConfirm(selectedCandidate)} type="button">이 콜 선택하기</button>
      <p className="carrier-choice-note"><Icon name="info" size={17} /> 최종 선택은 운송인에게 있습니다</p>
    </div>
  )
}

function RouteMapScreen({ route, progress, hasMoreOffers, onArrive }: { route: string; progress: number; hasMoreOffers: boolean; onArrive: () => void }) {
  const [loading, error] = useKakaoLoader({ appkey: import.meta.env.VITE_KAKAOMAP_API_KEY ?? '' })
  const { originLabel, destinationLabel, origin, destination } = routeEndpoints(route)
  const truckPosition = origin && destination
    ? {
        lat: origin.lat + (destination.lat - origin.lat) * (progress / 100),
        lng: origin.lng + (destination.lng - origin.lng) * (progress / 100),
      }
    : null

  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="route" /></span>
        <div><h2>이동 경로</h2><p>{originLabel} → {destinationLabel}</p></div>
      </div>
      <div className="carrier-map-frame">
        {!origin || !destination ? (
          <div className="carrier-map-fallback">경로 좌표를 찾을 수 없습니다.</div>
        ) : loading ? (
          <div className="carrier-map-fallback">지도를 불러오는 중…</div>
        ) : error ? (
          <div className="carrier-map-fallback">지도를 불러올 수 없습니다.</div>
        ) : (
          <Map
            center={{ lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 }}
            onCreate={(map) => {
              const bounds = new kakao.maps.LatLngBounds()
              bounds.extend(new kakao.maps.LatLng(origin.lat, origin.lng))
              bounds.extend(new kakao.maps.LatLng(destination.lat, destination.lng))
              map.setBounds(bounds, 40)
            }}
            style={{ width: '100%', height: '260px' }}
          >
            <MapMarker position={origin} />
            <MapMarker position={destination} />
            <Polyline path={[origin, destination]} strokeColor="#f2d800" strokeOpacity={0.9} strokeStyle="solid" strokeWeight={4} />
            {truckPosition && (
              <CustomOverlayMap position={truckPosition} zIndex={10}>
                <span className="carrier-map-truck"><Icon name="truck" size={14} /></span>
              </CustomOverlayMap>
            )}
          </Map>
        )}
      </div>
      <div className="route-progress"><span style={{ width: `${progress}%` }} /></div>
      <section className="carrier-brief-card">
        <span className="brief-icon"><Icon name="shield" /></span>
        <div><strong>안전 우선</strong><p>운전 중에는 판단을 요구하지 않습니다. 정차 후 다음 콜을 확인하세요.</p></div>
      </section>
      <button className="button button--primary carrier-wide-button" onClick={onArrive} type="button">
        {hasMoreOffers ? '정차 확인 · 다음 콜 보기' : '하차 완료 · 운행 종료'}
      </button>
    </div>
  )
}

function BackhaulDecisionScreen({ offer, onAccept, onGoHome }: { offer: BackhaulOffer; onAccept: () => void; onGoHome: () => void }) {
  return (
    <div className="carrier-scroll candidate-screen">
      <section className="safety-brief is-backhaul">
        <span><Icon name="truck" size={25} /></span>
        <div><strong>복화 추천 콜이 도착했습니다</strong><p>귀가 방향과 맞는 콜이에요</p></div>
      </section>
      <div className="candidate-list">
        <div className="candidate-card is-backhaul">
          <span className="candidate-main">
            <strong>{offer.route}</strong>
            <small>{offer.time} · 공차 {offer.emptyKm}km</small>
            <span className="candidate-tags">{offer.tags.map((tag) => <em key={tag}>{tag}</em>)}</span>
          </span>
          <span className="candidate-costs">
            <span><small>운임</small><b>{offer.fare}만원</b></span>
            <span className="net-line"><small>실수령</small><b>{offer.net}만원</b></span>
          </span>
        </div>
      </div>
      <p className="carrier-choice-note"><Icon name="info" size={17} /> 지금 위치에서 공차 {offer.emptyKm}km 거리에 있는 콜이에요</p>
      <button className="button button--primary carrier-wide-button" onClick={onAccept} type="button">이 콜 수락하고 이동하기</button>
      <button className="button carrier-wide-button" onClick={onGoHome} type="button">집으로 돌아가기</button>
    </div>
  )
}

function TripSummaryScreen({ selectedCandidate, acceptedOffers, onRestart }: { selectedCandidate: Candidate | null; acceptedOffers: BackhaulOffer[]; onRestart: () => void }) {
  const totalNet = (selectedCandidate?.net ?? 0) + acceptedOffers.reduce((sum, offer) => sum + offer.net, 0)
  const totalCalls = (selectedCandidate ? 1 : 0) + acceptedOffers.length
  const reducedEmptyKm = acceptedOffers.reduce(
    (sum, offer) => sum + Math.max(0, offer.expectedEmptyKmWithoutBackhaul - offer.emptyKm),
    0,
  )
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="chart" /></span>
        <div><h2>오늘의 운행 요약</h2><p>수고하셨습니다. 오늘 성과를 확인하세요.</p></div>
      </div>
      <section className="performance-hero">
        <Icon name="wallet" size={35} />
        <span>오늘 총 실수령</span>
        <strong>{totalNet.toFixed(1)}만원</strong>
        <p>총 {totalCalls}건의 콜을 완료했습니다.</p>
      </section>
      <div className="carrier-quick-grid">
        <article title="복화 미연결 예상 공차거리에서 실제 복화 상차지까지의 공차거리를 뺀 값">
          <Icon name="route" />
          <strong>{reducedEmptyKm}km</strong>
          <span>복화로 줄인 공차</span>
          <small>미연결 예상 대비</small>
        </article>
        <article><Icon name="leaf" /><strong>{acceptedOffers.length}건</strong><span>복화 연결</span></article>
      </div>
      <button className="button button--primary carrier-wide-button" onClick={onRestart} type="button">처음으로</button>
    </div>
  )
}

function NotificationToast({ kind, onOpen }: { kind: NotificationKind; onOpen: () => void }) {
  if (!kind) return null
  const copy = kind === 'ai-candidate'
    ? { title: 'AI 추천 후보 3건이 도착했어요', body: '지금 조건에 맞는 콜을 확인해 보세요' }
    : { title: '복화 추천 콜이 있어요', body: '귀가 방향과 맞는 콜을 확인해 보세요' }
  return (
    <button className="carrier-alert-toast" onClick={onOpen} type="button">
      <span className="icon-box icon-box--yellow"><Icon name="spark" /></span>
      <span><strong>{copy.title}</strong><span>{copy.body}</span></span>
      <Icon name="chevron" size={18} />
    </button>
  )
}

export function CarrierWorkspace({ onReturnToShipper }: { onReturnToShipper: () => void }) {
  const [stage, setStage] = useState<CarrierStage>('base-profile')
  const [notification, setNotification] = useState<NotificationKind>(null)
  const [legIndex, setLegIndex] = useState(0)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [acceptedOffers, setAcceptedOffers] = useState<BackhaulOffer[]>([])
  const [activeRoute, setActiveRoute] = useState('')
  const [preferences, setPreferences] = useState<CarrierPreferences | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (stage !== 'home' || notification) return
    const timer = window.setTimeout(() => setNotification('ai-candidate'), 2200)
    return () => window.clearTimeout(timer)
  }, [stage, notification])

  useEffect(() => {
    if (stage !== 'route-map') return
    setProgress(0)
    const interval = window.setInterval(() => {
      setProgress((prev) => (prev >= 92 ? 92 : prev + 4))
    }, 180)
    return () => window.clearInterval(interval)
  }, [stage, activeRoute])

  useEffect(() => {
    if (stage !== 'route-map' || notification || legIndex >= backhaulOffers.length) return
    if (progress >= 55) setNotification('backhaul')
  }, [stage, notification, legIndex, progress])

  const hasMoreOffers = legIndex < backhaulOffers.length

  const openNotification = () => {
    if (!notification) return
    setStage(notification === 'ai-candidate' ? 'candidates' : 'backhaul-decision')
    setNotification(null)
  }

  const restart = () => {
    setStage('base-profile')
    setNotification(null)
    setLegIndex(0)
    setSelectedCandidate(null)
    setAcceptedOffers([])
    setActiveRoute('')
    setPreferences(null)
  }

  return (
    <div className="carrier-page">
      <aside className="carrier-stage-rail">
        <span className="mono-label">TODAY'S ROUTE</span>
        <h2>운송인 흐름</h2>
        <div className="stage-list">
          {(['base-profile', 'preferences', 'home', 'candidates', 'route-map', 'backhaul-decision', 'summary'] as CarrierStage[]).map((s) => (
            <div className={s === stage ? 'is-active' : ''} key={s}>
              <span><Icon name="truck" size={16} /></span>
              <p><strong>{carrierStageLabels[s]}</strong></p>
            </div>
          ))}
        </div>
        <div className="rail-principle"><Icon name="shield" /><p>정차 시에만 상세 비교를 열어 안전한 선택을 돕습니다.</p></div>
      </aside>
      <div className="carrier-device-shell">
        <button
          aria-label="화주·주선사 화면으로 전환"
          className="carrier-return-button"
          onClick={onReturnToShipper}
          title="화주·주선사 화면으로 전환"
          type="button"
        >
          <Icon name="switch" />
        </button>
        <div className="carrier-phone">
          <div aria-hidden="true" className="carrier-system-bar">
            <time dateTime="09:41">9:41</time>
            <span className="carrier-dynamic-island" />
            <img alt="" className="carrier-system-icons" src="/ios-status-icons.svg" />
          </div>
          <div className="carrier-screen">
            <header className="carrier-header">
              <div className="carrier-header-titles">
                <h1>Mov!n <span>Carrier</span></h1>
                <span className="mono-label">{carrierStageLabels[stage]}</span>
              </div>
            </header>
            <div className="carrier-content">
              {stage === 'base-profile' && <BaseProfileScreen onNext={() => setStage('preferences')} />}
              {stage === 'preferences' && (
                <PreferenceSetupScreen
                  onNext={(prefs) => {
                    setPreferences(prefs)
                    setStage('home')
                  }}
                />
              )}
              {stage === 'home' && <OrderBoardScreen preferences={preferences} scanning={!notification} />}
              {stage === 'candidates' && (
                <CandidateSelectScreen
                  onConfirm={(candidate) => {
                    setSelectedCandidate(candidate)
                    setActiveRoute(candidate.route)
                    setStage('route-map')
                  }}
                />
              )}
              {stage === 'route-map' && (
                <RouteMapScreen
                  hasMoreOffers={hasMoreOffers}
                  onArrive={() => {
                    if (hasMoreOffers) {
                      setNotification('backhaul')
                    } else {
                      setStage('summary')
                    }
                  }}
                  progress={progress}
                  route={activeRoute}
                />
              )}
              {stage === 'backhaul-decision' && (
                <BackhaulDecisionScreen
                  offer={backhaulOffers[legIndex]}
                  onAccept={() => {
                    const offer = backhaulOffers[legIndex]
                    setAcceptedOffers((prev) => [...prev, offer])
                    setActiveRoute(offer.route)
                    setLegIndex((prev) => prev + 1)
                    setStage('route-map')
                  }}
                  onGoHome={() => setStage('summary')}
                />
              )}
              {stage === 'summary' && (
                <TripSummaryScreen acceptedOffers={acceptedOffers} onRestart={restart} selectedCandidate={selectedCandidate} />
              )}
            </div>
            <NotificationToast
              kind={stage === 'home' || stage === 'route-map' ? notification : null}
              onOpen={openNotification}
            />
          </div>
          <div aria-hidden="true" className="carrier-device-footer">
            <img alt="" src="/ios-home-indicator.svg" />
          </div>
        </div>
      </div>
    </div>
  )
}
