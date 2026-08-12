import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { TimeWindowDial } from './TimeWindowDial'
import {
  cargoIsComplete,
  formatCargoWeight,
  formatDate,
  formatTimeWindow,
  getCargoWeightKg,
  itemOptions,
  regionLocations,
  regionOptions,
  type CargoForm,
  vehicleOptions,
} from './shipperModel'
import { useDestinationChoices, useOriginChoices, type CatalogState, type LocationChoices } from './useCatalogOptions'

type CargoRegistrationProps = {
  cargo: CargoForm
  onChange: (cargo: CargoForm) => void
  onContinue: () => void
  onOpenPreferences: () => void
  preferencesReady: boolean
  catalog: CatalogState
}

// 카탈로그를 못 받았을 때만 쓰는 기존 하드코딩 선택지입니다.
const fallbackChoices: LocationChoices = { regions: regionOptions.filter((region) => region !== '기타'), byRegion: regionLocations }

function CalendarPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const today = useMemo(() => new Date(), [])
  const initialDate = value ? new Date(`${value}T00:00:00`) : today
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const previousLastDate = new Date(year, month, 0).getDate()

  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - firstWeekday + 1
    let cellYear = year
    let cellMonth = month
    let day = dayOffset
    let outside = false
    if (dayOffset <= 0) {
      outside = true
      cellMonth -= 1
      day = previousLastDate + dayOffset
    } else if (dayOffset > lastDate) {
      outside = true
      cellMonth += 1
      day = dayOffset - lastDate
    }
    const date = new Date(cellYear, cellMonth, day)
    cellYear = date.getFullYear()
    cellMonth = date.getMonth()
    const iso = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return { day, iso, outside, disabled: date < startOfToday }
  })

  return (
    <div className="calendar-picker">
      <div className="calendar-picker__header">
        <button aria-label="이전 달" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} type="button"><Icon name="chevron" size={18} /></button>
        <strong>{year}년 {month + 1}월</strong>
        <button aria-label="다음 달" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} type="button"><Icon name="chevron" size={18} /></button>
      </div>
      <div className="calendar-picker__weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-picker__days">
        {cells.map((cell) => (
          <button
            aria-pressed={value === cell.iso}
            className={`${cell.outside ? 'is-outside' : ''}${value === cell.iso ? ' is-selected' : ''}`}
            disabled={cell.disabled}
            key={cell.iso}
            onClick={() => onChange(cell.iso)}
            type="button"
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  )
}

function LocationPicker({
  title,
  step,
  region,
  value,
  choices,
  hint,
  onChange,
}: {
  title: string
  step: number
  region: string
  value: string
  choices: LocationChoices
  hint?: string
  onChange: (region: string, value: string) => void
}) {
  const locations = choices.byRegion[region] ?? []
  return (
    <section className="cargo-field cargo-field--location">
      <div className="cargo-field__title"><span>{step}</span><h2>{title}</h2>{value && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
      {hint && <p className="cargo-field__hint">{hint}</p>}
      <div className="region-options">
        {choices.regions.map((option) => (
          <button aria-pressed={region === option} className={region === option ? 'is-selected' : ''} key={option} onClick={() => onChange(option, '')} type="button">{option}</button>
        ))}
      </div>
      {region && locations.length > 0 && (
        <div className="detail-options" aria-label={`${title} 세부 위치`}>
          {locations.map((location) => (
            <button aria-pressed={value === location} className={value === location ? 'is-selected' : ''} key={location} onClick={() => onChange(region, location)} type="button">{location}</button>
          ))}
        </div>
      )}
    </section>
  )
}

function ChoiceSection({
  title,
  step,
  options,
  value,
  onChange,
}: {
  title: string
  step: number
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const custom = value && !options.includes(value) ? value : ''
  const otherSelected = value === '기타' || Boolean(custom)
  return (
    <section className="cargo-field">
      <div className="cargo-field__title"><span>{step}</span><h2>{title}</h2>{value && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
      <div className="cargo-choice-grid">
        {options.map((option) => (
          <button aria-pressed={value === option || (option === '기타' && otherSelected)} className={value === option || (option === '기타' && otherSelected) ? 'is-selected' : ''} key={option} onClick={() => onChange(option)} type="button">
            {title === '차량 선택' && option !== '기타' && <Icon name="truck" size={20} />}
            {option}
          </button>
        ))}
      </div>
      {otherSelected && <label className="other-input"><span>{title} 기타 항목</span><input onChange={(event) => onChange(event.target.value || '기타')} placeholder="직접 입력" value={custom} /></label>}
    </section>
  )
}

export function CargoRegistration({ cargo, onChange, onContinue, onOpenPreferences, preferencesReady, catalog }: CargoRegistrationProps) {
  const routes = catalog.data?.routes
  const catalogOrigins = useOriginChoices(routes)
  const catalogDestinations = useDestinationChoices(routes, cargo.origin)
  const usingCatalog = Boolean(routes?.length)
  const originChoices = usingCatalog ? catalogOrigins : fallbackChoices
  const destinationChoices = usingCatalog ? catalogDestinations : fallbackChoices
  const vehicleChoices = catalog.data?.vehicleTypes.length ? catalog.data.vehicleTypes.map((option) => option.label) : vehicleOptions
  const itemChoices = catalog.data?.items.length ? catalog.data.items.map((option) => option.label) : itemOptions
  const cargoWeightKg = getCargoWeightKg(cargo.cargoWeight)
  const cargoDescriptionComplete = Boolean(cargo.cargoDescription.trim())
  const cargoWeightComplete = cargoWeightKg !== null
  const cargoDetailComplete = cargoDescriptionComplete && cargoWeightComplete
  const completed = [cargo.origin, cargo.destination, cargo.vehicle, cargo.item, cargoDescriptionComplete, cargoWeightComplete, cargo.loadingDate, cargo.startMinutes !== null && cargo.endMinutes !== null].filter(Boolean).length
  const ready = cargoIsComplete(cargo) && preferencesReady
  const summary = [
    ['출발지', cargo.origin],
    ['도착지', cargo.destination],
    ['차량', cargo.vehicle],
    ['품목', cargo.item],
    ['품목 상세', cargo.cargoDescription],
    ['중량', cargoWeightComplete ? formatCargoWeight(cargoWeightKg) : '미선택'],
    ['상차 날짜', formatDate(cargo.loadingDate)],
    ['상차 시간', formatTimeWindow(cargo)],
  ]

  return (
    <div className="flow-screen cargo-registration">
      <header className="flow-heading">
        <div><h1>화물 정보 등록</h1><p>운송 기본 정보를 선택하면 등록 예정 노선이 한 칸씩 채워집니다.</p></div>
        <div className="flow-heading__progress"><span>콜 정보 진행률</span><strong>{completed}/8</strong><div><i style={{ width: `${(completed / 8) * 100}%` }} /></div></div>
      </header>

      {catalog.status === 'error' && (
        <div className="requirement-banner">
          <Icon name="shield" size={20} />
          <p><strong>선택지를 예측 서버에서 불러오지 못했습니다.</strong><span>{catalog.message} 기본 목록으로 진행하면 예상 수치가 참고값으로 표시됩니다.</span></p>
          <button onClick={catalog.reload} type="button">다시 시도</button>
        </div>
      )}

      <div className="cargo-locations panel-v3">
        <LocationPicker
          choices={originChoices}
          onChange={(originRegion, origin) => onChange({ ...cargo, originRegion, origin, destinationRegion: '', destination: '' })}
          region={cargo.originRegion}
          step={1}
          title="출발지"
          value={cargo.origin}
        />
        <LocationPicker
          choices={destinationChoices}
          hint={usingCatalog && cargo.origin ? `${cargo.origin}에서 실제 운송 이력이 있는 도착지만 표시합니다.` : undefined}
          onChange={(destinationRegion, destination) => onChange({ ...cargo, destinationRegion, destination })}
          region={cargo.destinationRegion}
          step={2}
          title="도착지"
          value={cargo.destination}
        />
      </div>

      <ChoiceSection onChange={(vehicle) => onChange({ ...cargo, vehicle })} options={vehicleChoices} step={3} title="차량 선택" value={cargo.vehicle} />
      <ChoiceSection onChange={(item) => onChange({ ...cargo, item })} options={itemChoices} step={4} title="품목 선택" value={cargo.item} />

      <section className="cargo-field cargo-description panel-v3">
        <div className="cargo-field__title"><span>5</span><h2>화물 추가 정보</h2>{cargoDetailComplete && <em><Icon name="check" size={14} /> 입력 완료</em>}</div>
        <div className="cargo-description__fields">
          <label htmlFor="cargo-description"><span>품목 상세</span><input id="cargo-description" maxLength={160} onChange={(event) => onChange({ ...cargo, cargoDescription: event.target.value })} placeholder="예: 냉동 만두, 파렛트 4개" value={cargo.cargoDescription} /></label>
          <label htmlFor="cargo-weight"><span>중량</span><input aria-describedby="cargo-description-help" id="cargo-weight" inputMode="decimal" maxLength={30} onChange={(event) => onChange({ ...cargo, cargoWeight: event.target.value })} placeholder="예: 2,400kg 또는 2.5톤" value={cargo.cargoWeight} /></label>
        </div>
        <div className={`cargo-description__status${cargo.cargoWeight.trim() && cargoWeightKg === null ? ' is-warning' : cargoDetailComplete ? ' is-complete' : ''}`} id="cargo-description-help">
          <Icon name={cargoDetailComplete ? 'check' : 'info'} size={16} />
          <span>{cargoDetailComplete ? `인식 중량 ${formatCargoWeight(cargoWeightKg)} · 배차 및 AI 분석 입력값으로 저장됩니다.` : cargo.cargoWeight.trim() && cargoWeightKg === null ? '중량을 인식할 수 없어요. 숫자와 kg 또는 톤을 함께 입력해 주세요.' : !cargoDescriptionComplete && cargoWeightComplete ? '품목 상세를 입력해 주세요.' : cargoDescriptionComplete ? '중량을 kg 또는 톤 단위로 입력해 주세요.' : '품목 상세와 중량을 각각 입력해 주세요.'}</span>
        </div>
      </section>

      <section className="schedule-grid">
        <div className="cargo-field panel-v3">
          <div className="cargo-field__title"><span>6</span><h2>상차 날짜</h2>{cargo.loadingDate && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
          <CalendarPicker onChange={(loadingDate) => onChange({ ...cargo, loadingDate })} value={cargo.loadingDate} />
        </div>
        <div className="cargo-field panel-v3">
          <div className="cargo-field__title"><span>7</span><h2>상차 시간창</h2>{cargo.startMinutes !== null && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
          <TimeWindowDial endMinutes={cargo.endMinutes} onChange={(startMinutes, endMinutes) => onChange({ ...cargo, startMinutes, endMinutes })} startMinutes={cargo.startMinutes} />
        </div>
      </section>

      <section className="route-preview panel-v3">
        <div className="route-preview__title"><span>8</span><div><h2>등록 예정 노선</h2><p>조건 비교 전 입력 내용을 확인하세요.</p></div></div>
        <dl>{summary.map(([label, value]) => <div className={value && value !== '미선택' ? 'is-filled' : ''} key={label}><dt>{label}</dt><dd>{value || '미선택'}</dd>{value && value !== '미선택' && <Icon name="check" size={15} />}</div>)}</dl>
      </section>

      {!preferencesReady && <div className="requirement-banner"><Icon name="shield" size={20} /><p><strong>필수 설정이 아직 완료되지 않았습니다.</strong><span>각 질문에서 하나 이상 선택해야 조건 비교를 시작할 수 있어요.</span></p><button onClick={onOpenPreferences} type="button">필수 설정 열기</button></div>}
      <div className="screen-actions"><button className="primary-v3" disabled={!ready} onClick={onContinue} type="button">조건 비교 보기 <Icon name="chevron" size={18} /></button></div>
    </div>
  )
}
