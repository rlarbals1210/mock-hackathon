import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { CargoRegistration } from './CargoRegistration'
import { ConditionComparison } from './ConditionComparison'
import { MonthlyReport } from './MonthlyReport'
import { ProfileScreen } from './ProfileScreen'
import {
  cargoIsComplete,
  createOperation,
  emptyCargo,
  formatDate,
  formatTimeWindow,
  preferenceGroups,
  preferencesAreComplete,
  type CargoForm,
  type DecisionChoice,
  type OperationLog,
  type PreferenceGroupId,
  type PreferenceState,
  type ShipperSection,
} from './shipperModel'

export type { ShipperSection } from './shipperModel'

const preferenceStorageKey = 'movin-shipper-preferences:v3'
const workflowStorageKey = 'movin-shipper-workflow:v3'

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function loadPreferences(): PreferenceState {
  const parsed = readStorage<Partial<PreferenceState>>(preferenceStorageKey, {})
  return {
    result: Array.isArray(parsed.result) ? parsed.result.slice(0, 2) : [],
    schedule: Array.isArray(parsed.schedule) ? parsed.schedule.slice(0, 2) : [],
    carrier: Array.isArray(parsed.carrier) ? parsed.carrier.slice(0, 2) : [],
  }
}

type StoredWorkflow = {
  cargo?: CargoForm
  choice?: DecisionChoice
  adjustedHours?: number
  operations?: OperationLog[]
}

function WorkflowStepper({ preferencesReady, cargoReady, choice, active }: { preferencesReady: boolean; cargoReady: boolean; choice: DecisionChoice; active: ShipperSection }) {
  const steps: { section: ShipperSection; label: string; complete: boolean }[] = [
    { section: 'preferences', label: '필수 설정', complete: preferencesReady },
    { section: 'register', label: '콜 등록', complete: cargoReady },
    { section: 'compare', label: '조건 비교', complete: Boolean(choice) },
    { section: 'report', label: '리포트', complete: Boolean(choice) },
  ]
  return (
    <nav aria-label="화주 배차 진행 단계" className="workflow-stepper">
      {steps.map((step, index) => (
        <div className={`${step.complete ? 'is-complete' : ''}${active === step.section || (active === 'profile' && step.section === 'report') ? ' is-active' : ''}`} key={step.section}>
          <span>{step.complete ? <Icon name="check" size={14} /> : index + 1}</span>
          <strong>{step.label}</strong>
          <small>{step.complete ? '완료' : active === step.section ? '진행 중' : '대기'}</small>
        </div>
      ))}
    </nav>
  )
}

function PreferenceSettings({ preferences, saved, onChange, onSave }: { preferences: PreferenceState; saved: boolean; onChange: (group: PreferenceGroupId, option: string) => void; onSave: () => void }) {
  const [limitMessage, setLimitMessage] = useState<PreferenceGroupId | null>(null)
  const completedGroups = preferenceGroups.filter((group) => preferences[group.id].length > 0).length
  const ready = completedGroups === 3

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
    <div className="flow-screen preference-screen-v3">
      <header className="flow-heading">
        <div><h1>화주 선호 조건 설정</h1><p>발주할 때 중요하게 보는 조건을 모두 선택하세요.</p></div>
        <div className="flow-heading__progress"><span>전체 진행률</span><strong>{completedGroups}/3</strong><div><i style={{ width: `${(completedGroups / 3) * 100}%` }} /></div></div>
      </header>
      <div className="preference-guide-v3"><Icon name="info" size={18} /> 각 질문에서 하나 이상 선택해야 하며, 질문별로 최대 2개까지 선택할 수 있어요. 처음에는 아무 항목도 선택되지 않습니다.</div>
      <div className="preference-groups-v3">
        {preferenceGroups.map((group, index) => {
          const selected = preferences[group.id]
          return (
            <fieldset className="preference-group-v3 panel-v3" key={group.id}>
              <legend className="sr-only">{group.title}</legend>
              <header><div><span>{index + 1}</span><h2>{group.title}</h2></div><div className="question-progress"><strong>{selected.length ? `${selected.length}개 선택` : '1개 이상 필수'}</strong><i><b style={{ width: selected.length ? '100%' : '0%' }} /></i></div></header>
              <div className={`preference-options-v3 preference-options-v3--${group.options.length}`}>
                {group.options.map((option) => {
                  const isSelected = selected.includes(option.label)
                  return <button aria-pressed={isSelected} className={isSelected ? 'is-selected' : ''} key={option.label} onClick={() => toggle(group.id, option.label)} type="button"><span>{isSelected && <Icon name="check" size={15} />}</span><strong>{option.label}{option.detail && <small>{option.detail}</small>}</strong></button>
                })}
              </div>
              {limitMessage === group.id && <p className="preference-limit-v3" role="status">이 질문에서는 최대 2개까지만 선택할 수 있어요.</p>}
            </fieldset>
          )
        })}
      </div>
      <div className="preference-submit-v3"><button className="primary-v3" disabled={!ready} onClick={onSave} type="button">{saved ? '선호 조건 다시 저장하고 시작' : '선호 조건 저장하고 시작'} <Icon name="chevron" size={18} /></button><p>저장한 조건은 나중에 <strong>내 정보</strong>에서 다시 수정할 수 있어요.</p></div>
    </div>
  )
}

function StaticSummaryRail({ cargo, preferencesReady, choice }: { cargo: CargoForm; preferencesReady: boolean; choice: DecisionChoice }) {
  const items = [
    { label: '화주 조건', value: preferencesReady ? '선택 완료' : '선택 대기', complete: preferencesReady },
    { label: '콜 정보', value: cargoIsComplete(cargo) ? '입력 완료' : '입력 대기', complete: cargoIsComplete(cargo) },
    { label: '배차 결과', value: choice === 'adjusted' ? '조정안 선택' : choice === 'current' ? '현재 조건 선택' : cargoIsComplete(cargo) ? '조건 조합 중' : '콜 입력 대기', complete: Boolean(choice) },
  ]
  return (
    <aside className="static-summary-rail panel-v3">
      <header><h2>현재 선택 요약</h2><strong>{items.filter((item) => item.complete).length}/3</strong></header>
      <ol>{items.map((item, index) => <li className={item.complete ? 'is-complete' : ''} key={item.label}><span>{item.complete ? <Icon name="check" size={14} /> : index + 1}</span><div><strong>{item.label}</strong><small>{item.value}</small></div></li>)}</ol>
    </aside>
  )
}

function CurrentDispatchInfo({ cargo, preferencesReady, choice }: { cargo: CargoForm; preferencesReady: boolean; choice: DecisionChoice }) {
  const status = !preferencesReady ? '조건 선택 대기' : !cargoIsComplete(cargo) ? '콜 정보 입력 중' : !choice ? '조건 조합 중' : '운송인 응답 대기'
  const fields = [
    ['배차번호', choice ? 'MOV-2026-0812-042' : '미발급'],
    ['출발지', cargo.origin || '미선택'],
    ['도착지', cargo.destination || '미선택'],
    ['차량', cargo.vehicle || '미선택'],
    ['품목', cargo.item || '미선택'],
    ['상차 날짜', formatDate(cargo.loadingDate)],
    ['상차 시간', formatTimeWindow(cargo)],
    ['현재 상태', status],
  ]
  return (
    <section className="current-dispatch-v3 panel-v3">
      <header><h2>현재 배차 정보</h2></header>
      <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value === '미선택' || value === '미발급' ? 'is-unselected' : label === '현재 상태' ? 'is-status' : ''}>{value}</dd></div>)}</dl>
    </section>
  )
}

export function ShipperScreen({ section, onNavigate }: { section: ShipperSection; onNavigate: (section: ShipperSection) => void }) {
  const storedWorkflow = useMemo(() => readStorage<StoredWorkflow>(workflowStorageKey, {}), [])
  const [preferences, setPreferences] = useState<PreferenceState>(loadPreferences)
  const [saved, setSaved] = useState(() => preferencesAreComplete(preferences))
  const [cargo, setCargo] = useState<CargoForm>(() => ({ ...emptyCargo, ...storedWorkflow.cargo }))
  const [choice, setChoice] = useState<DecisionChoice>(storedWorkflow.choice ?? null)
  const [adjustedHours, setAdjustedHours] = useState(storedWorkflow.adjustedHours ?? 12)
  const [operations, setOperations] = useState<OperationLog[]>(storedWorkflow.operations ?? [])
  const [toast, setToast] = useState('')
  const preferencesReady = preferencesAreComplete(preferences) && saved
  const cargoReady = cargoIsComplete(cargo)
  const showSummary = section === 'register' || section === 'compare'
  const showDispatch = section === 'compare' && cargoReady

  useEffect(() => {
    try {
      window.localStorage.setItem(workflowStorageKey, JSON.stringify({ cargo, choice, adjustedHours, operations }))
    } catch {
      // The flow remains usable in memory when storage is unavailable.
    }
  }, [adjustedHours, cargo, choice, operations])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const addOperation = (title: string, detail: string) => setOperations((current) => [createOperation(title, detail), ...current].slice(0, 12))

  const updatePreference = (group: PreferenceGroupId, option: string) => {
    setSaved(false)
    setChoice(null)
    setPreferences((current) => {
      const values = current[group]
      return { ...current, [group]: values.includes(option) ? values.filter((value) => value !== option) : [...values, option] }
    })
  }

  const savePreferences = () => {
    try {
      window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences))
    } catch {
      setToast('브라우저 저장소를 사용할 수 없어 이 화면에서만 조건을 유지합니다.')
    }
    setSaved(true)
    addOperation('선호 조건 저장', Object.values(preferences).flat().join(' · '))
    setToast('선호 조건을 저장했습니다. 콜 등록을 이어서 작성해 주세요.')
    onNavigate('register')
  }

  const continueToComparison = () => {
    addOperation('콜 등록 완료', `${cargo.origin} → ${cargo.destination} · ${cargo.vehicle} · ${formatTimeWindow(cargo)}`)
    setToast('콜 정보를 저장했습니다. 현재 조건과 완화 조건을 비교합니다.')
    onNavigate('compare')
  }

  const chooseCondition = (nextChoice: Exclude<DecisionChoice, null>, nextAdjustedHours: number) => {
    setChoice(nextChoice)
    setAdjustedHours(nextAdjustedHours)
    addOperation(nextChoice === 'adjusted' ? '조정안 선택' : '현재 조건 선택', nextChoice === 'adjusted' ? `상차 가능 범위 ${nextAdjustedHours}시간` : formatTimeWindow(cargo))
    setToast(nextChoice === 'adjusted' ? '조정안이 최근 선택으로 저장되었습니다.' : '현재 조건 유지가 최근 선택으로 저장되었습니다.')
    onNavigate('report')
  }

  const content = section === 'preferences'
    ? <PreferenceSettings onChange={updatePreference} onSave={savePreferences} preferences={preferences} saved={saved} />
    : section === 'register'
      ? <CargoRegistration cargo={cargo} onChange={(nextCargo) => { setCargo(nextCargo); setChoice(null) }} onContinue={continueToComparison} onOpenPreferences={() => onNavigate('preferences')} preferencesReady={preferencesReady} />
      : section === 'compare'
        ? <ConditionComparison cargo={cargo} choice={choice} onChoose={chooseCondition} onOpenRegistration={() => onNavigate('register')} />
        : section === 'report'
          ? <MonthlyReport adjustedHours={adjustedHours} cargo={cargo} choice={choice} operations={operations} />
          : <ProfileScreen onEditPreferences={() => onNavigate('preferences')} onOpenReport={() => onNavigate('report')} operations={operations} preferences={preferences} timeProposalCount={choice ? 1 : 0} />

  return (
    <div className="shipper-workspace-v3">
      <WorkflowStepper active={section} cargoReady={cargoReady} choice={choice} preferencesReady={preferencesReady} />
      <div className={`workspace-v3-grid${showSummary ? '' : ' workspace-v3-grid--single'}`}>
        <div>{content}</div>
        {showSummary && <StaticSummaryRail cargo={cargo} choice={choice} preferencesReady={preferencesReady} />}
      </div>
      {showDispatch && <CurrentDispatchInfo cargo={cargo} choice={choice} preferencesReady={preferencesReady} />}
      {toast && <div className="toast-v3" role="status"><span><Icon name="check" size={17} /></span><div><strong>작업이 저장됐어요.</strong><small>{toast}</small></div><button aria-label="알림 닫기" onClick={() => setToast('')} type="button">×</button></div>}
    </div>
  )
}
