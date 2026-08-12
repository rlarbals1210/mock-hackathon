import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { TimeWindowDial } from './TimeWindowDial'
import {
  cargoIsComplete,
  formatDate,
  formatTimeWindow,
  itemOptions,
  regionLocations,
  regionOptions,
  type CargoForm,
  vehicleOptions,
} from './shipperModel'

type CargoRegistrationProps = {
  cargo: CargoForm
  onChange: (cargo: CargoForm) => void
  onContinue: () => void
  onOpenPreferences: () => void
  preferencesReady: boolean
}

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
  onChange,
}: {
  title: string
  step: number
  region: string
  value: string
  onChange: (region: string, value: string) => void
}) {
  return (
    <section className="cargo-field cargo-field--location">
      <div className="cargo-field__title"><span>{step}</span><h2>{title}</h2>{value && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
      <div className="region-options">
        {regionOptions.map((option) => (
          <button aria-pressed={region === option} className={region === option ? 'is-selected' : ''} key={option} onClick={() => onChange(option, '')} type="button">{option}</button>
        ))}
      </div>
      {region && region !== '기타' && (
        <div className="detail-options" aria-label={`${title} 세부 위치`}>
          {regionLocations[region].map((location) => (
            <button aria-pressed={value === location} className={value === location ? 'is-selected' : ''} key={location} onClick={() => onChange(region, location)} type="button">{location}</button>
          ))}
        </div>
      )}
      {region === '기타' && (
        <label className="other-input"><span>{title} 직접 입력</span><input onChange={(event) => onChange('기타', event.target.value)} placeholder="예: 경기 시흥 정왕동" value={value} /></label>
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

export function CargoRegistration({ cargo, onChange, onContinue, onOpenPreferences, preferencesReady }: CargoRegistrationProps) {
  const completed = [cargo.origin, cargo.destination, cargo.vehicle, cargo.item, cargo.loadingDate, cargo.startMinutes !== null && cargo.endMinutes !== null].filter(Boolean).length
  const ready = cargoIsComplete(cargo) && preferencesReady
  const summary = [
    ['출발지', cargo.origin],
    ['도착지', cargo.destination],
    ['차량', cargo.vehicle],
    ['품목', cargo.item],
    ['상차 날짜', formatDate(cargo.loadingDate)],
    ['상차 시간', formatTimeWindow(cargo)],
  ]

  return (
    <div className="flow-screen cargo-registration">
      <header className="flow-heading">
        <div><h1>화물 정보 등록</h1><p>운송 기본 정보를 선택하면 등록 예정 노선이 한 칸씩 채워집니다.</p></div>
        <div className="flow-heading__progress"><span>콜 정보 진행률</span><strong>{completed}/6</strong><div><i style={{ width: `${(completed / 6) * 100}%` }} /></div></div>
      </header>

      <div className="cargo-locations panel-v3">
        <LocationPicker onChange={(originRegion, origin) => onChange({ ...cargo, originRegion, origin })} region={cargo.originRegion} step={1} title="출발지" value={cargo.origin} />
        <LocationPicker onChange={(destinationRegion, destination) => onChange({ ...cargo, destinationRegion, destination })} region={cargo.destinationRegion} step={2} title="도착지" value={cargo.destination} />
      </div>

      <ChoiceSection onChange={(vehicle) => onChange({ ...cargo, vehicle })} options={vehicleOptions} step={3} title="차량 선택" value={cargo.vehicle} />
      <ChoiceSection onChange={(item) => onChange({ ...cargo, item })} options={itemOptions} step={4} title="품목 선택" value={cargo.item} />

      <section className="schedule-grid">
        <div className="cargo-field panel-v3">
          <div className="cargo-field__title"><span>5</span><h2>상차 날짜</h2>{cargo.loadingDate && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
          <CalendarPicker onChange={(loadingDate) => onChange({ ...cargo, loadingDate })} value={cargo.loadingDate} />
        </div>
        <div className="cargo-field panel-v3">
          <div className="cargo-field__title"><span>6</span><h2>상차 시간창</h2>{cargo.startMinutes !== null && <em><Icon name="check" size={14} /> 선택 완료</em>}</div>
          <TimeWindowDial endMinutes={cargo.endMinutes} onChange={(startMinutes, endMinutes) => onChange({ ...cargo, startMinutes, endMinutes })} startMinutes={cargo.startMinutes} />
        </div>
      </section>

      <section className="route-preview panel-v3">
        <div className="route-preview__title"><span>7</span><div><h2>등록 예정 노선</h2><p>조건 비교 전 입력 내용을 확인하세요.</p></div></div>
        <dl>{summary.map(([label, value]) => <div className={value && value !== '미선택' ? 'is-filled' : ''} key={label}><dt>{label}</dt><dd>{value || '미선택'}</dd>{value && value !== '미선택' && <Icon name="check" size={15} />}</div>)}</dl>
      </section>

      {!preferencesReady && <div className="requirement-banner"><Icon name="shield" size={20} /><p><strong>필수 설정이 아직 완료되지 않았습니다.</strong><span>각 질문에서 하나 이상 선택해야 조건 비교를 시작할 수 있어요.</span></p><button onClick={onOpenPreferences} type="button">필수 설정 열기</button></div>}
      <div className="screen-actions"><button className="primary-v3" disabled={!ready} onClick={onContinue} type="button">조건 비교 보기 <Icon name="chevron" size={18} /></button></div>
    </div>
  )
}
