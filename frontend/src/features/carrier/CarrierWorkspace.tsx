import { useEffect, useState } from 'react'
import { CustomOverlayMap, Map, MapMarker, Polyline, useKakaoLoader } from 'react-kakao-maps-sdk'
import { Icon } from '../../components/Icon'
import { backhaulOffers, candidates, cityCoords, orders, type BackhaulOffer, type Candidate } from '../../data'
import { carrierStageLabels, type CarrierStage, type NotificationKind } from './flow'

function routeEndpoints(route: string) {
  const [originLabel, destinationLabel] = route.split('→').map((part) => part.trim())
  return { originLabel, destinationLabel, origin: cityCoords[originLabel], destination: cityCoords[destinationLabel] }
}

function LoginScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="truck" /></span>
        <div><h2>Mov!n Carrier</h2><p>운송인으로 로그인하고 오늘의 콜을 확인하세요.</p></div>
      </div>
      <button className="button button--primary carrier-wide-button" onClick={onNext} type="button">카카오로 시작하기</button>
    </div>
  )
}

function PreferenceChipGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
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

export type CarrierPreferences = { route: string; time: string; day: string }

const routeOptions = ['부산 ↔ 수도권', '대구 ↔ 인천', '광주 ↔ 대전']
const timeOptions = ['오전 상차', '오후 상차', '야간 상차']
const dayOptions = ['금요일 부산', '일요일 부산', '상관없음']

function preferredOriginCity(route: string) {
  return route.split(' ↔ ')[0]
}

function PreferenceSetupScreen({ onNext }: { onNext: (preferences: CarrierPreferences) => void }) {
  const [route, setRoute] = useState(routeOptions[0])
  const [time, setTime] = useState(timeOptions[1])
  const [day, setDay] = useState(dayOptions[0])
  return (
    <div className="carrier-scroll carrier-simple-screen">
      <div className="simple-screen-heading">
        <span className="icon-box icon-box--yellow"><Icon name="shield" /></span>
        <div><h2>선호 조건 설정</h2><p>운행 전에 선호 조건을 알려주시면 더 정확한 콜을 추천해 드려요.</p></div>
      </div>
      <PreferenceChipGroup label="주요 노선" onSelect={setRoute} options={routeOptions} selected={route} />
      <PreferenceChipGroup label="선호 시간" onSelect={setTime} options={timeOptions} selected={time} />
      <PreferenceChipGroup label="귀가 희망" onSelect={setDay} options={dayOptions} selected={day} />
      <button className="button button--primary carrier-wide-button" onClick={() => onNext({ route, time, day })} type="button">저장하고 시작하기</button>
    </div>
  )
}

function OrderBoardScreen({ scanning, preferences }: { scanning: boolean; preferences: CarrierPreferences | null }) {
  const preferredOrigin = preferences ? preferredOriginCity(preferences.route) : null
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
              {matchesPreference && <span className="candidate-tags"><em>선호 노선</em></span>}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CandidateSelectScreen({ onConfirm }: { onConfirm: (candidate: Candidate) => void }) {
  const [selected, setSelected] = useState(1)
  const selectedCandidate = candidates.find((candidate) => candidate.id === selected) ?? candidates[0]
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
              {isSelected && <span className="recommendation-label">추천</span>}
            </button>
          )
        })}
      </div>
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
            <Polyline path={[origin, destination]} strokeColor="#f5a623" strokeOpacity={0.9} strokeStyle="solid" strokeWeight={4} />
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
  const totalEmptyKm = (selectedCandidate?.emptyKm ?? 0) + acceptedOffers.reduce((sum, offer) => sum + offer.emptyKm, 0)
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
        <article><Icon name="route" /><strong>{totalEmptyKm}km</strong><span>총 공차 이동</span></article>
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
  const [stage, setStage] = useState<CarrierStage>('login')
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
    setStage('login')
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
          {(['login', 'preferences', 'home', 'candidates', 'route-map', 'backhaul-decision', 'summary'] as CarrierStage[]).map((s) => (
            <div className={s === stage ? 'is-active' : ''} key={s}>
              <span><Icon name="truck" size={16} /></span>
              <p><strong>{carrierStageLabels[s]}</strong></p>
            </div>
          ))}
        </div>
        <div className="rail-principle"><Icon name="shield" /><p>정차 시에만 상세 비교를 열어 안전한 선택을 돕습니다.</p></div>
      </aside>
      <div className="carrier-phone">
        <header className="carrier-header">
          <div className="carrier-header-titles">
            <h1>Mov!n <span>Carrier</span></h1>
            <span className="mono-label">{carrierStageLabels[stage]}</span>
          </div>
          <div>
            <button aria-label="화주·주선사 화면으로 전환" onClick={onReturnToShipper} type="button"><Icon name="switch" /></button>
            <button aria-label="알림" onClick={openNotification} type="button">
              <Icon name="bell" />
              {notification && <span className="carrier-notify-dot" />}
            </button>
          </div>
        </header>
        <div className="carrier-content">
          {stage === 'login' && <LoginScreen onNext={() => setStage('preferences')} />}
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
    </div>
  )
}
