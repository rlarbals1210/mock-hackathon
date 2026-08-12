import { Icon } from '../../components/Icon'
import { preferenceGroups, type OperationLog, type PreferenceState } from './shipperModel'

type ProfileScreenProps = {
  preferences: PreferenceState
  operations: OperationLog[]
  onEditPreferences: () => void
}

export function ProfileScreen({ preferences, operations, onEditPreferences }: ProfileScreenProps) {
  return (
    <div className="flow-screen profile-screen-v3">
      <header className="flow-heading"><div><h1>내 정보</h1><p>화주 계정과 배차 선호 조건을 관리합니다.</p></div></header>

      <section className="company-overview panel-v3">
        <span className="company-overview__icon"><Icon name="plus" /></span>
        <div><h2>Mov!n</h2><p><em>화주</em> 화주 계정 · SHIPPER-0001</p></div>
      </section>

      <div className="profile-layout-v3 profile-layout-v3--account">
        <section className="profile-preference-card panel-v3">
          <div className="section-heading-v3"><Icon name="shield" /><div><h2>내 선호 조건</h2><p>콜 등록과 조건 비교의 기본 판단 기준</p></div><button onClick={onEditPreferences} type="button">선호 조건 수정</button></div>
          <dl>{preferenceGroups.map((group) => <div key={group.id}><dt>{group.shortTitle}</dt><dd>{preferences[group.id].length ? preferences[group.id].join(' · ') : '미설정'}</dd></div>)}</dl>
        </section>

        <section className="profile-operations panel-v3">
          <div className="section-heading-v3"><Icon name="clock" /><div><h2>최근 운영 기록</h2><p>현재 접속에서 진행한 배차 작업</p></div></div>
          <ol>{operations.length ? operations.slice(0, 6).map((operation, index) => <li key={operation.id}><span>{index + 1}</span><div><strong>{operation.title}</strong><small>{operation.time} · {operation.detail}</small></div></li>) : <li className="is-empty"><span>1</span><div><strong>기록 대기</strong><small>선호 조건을 저장하면 기록이 시작됩니다.</small></div></li>}</ol>
        </section>
      </div>
    </div>
  )
}
