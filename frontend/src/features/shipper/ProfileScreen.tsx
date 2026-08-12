import { Icon } from '../../components/Icon'
import { preferenceGroups, type OperationLog, type PreferenceState } from './shipperModel'

type ProfileScreenProps = {
  preferences: PreferenceState
  operations: OperationLog[]
  timeProposalCount: number
  onEditPreferences: () => void
  onOpenReport: () => void
}

export function ProfileScreen({ preferences, operations, timeProposalCount, onEditPreferences, onOpenReport }: ProfileScreenProps) {
  return (
    <div className="flow-screen profile-screen-v3">
      <header className="flow-heading"><div><span className="eyebrow">SHIPPER PROFILE & DATA</span><h1>내 정보</h1><p>선호 조건, 사용 데이터, 최근 운영 기록을 한곳에서 관리합니다.</p></div></header>

      <section className="company-overview panel-v3">
        <span className="company-overview__icon"><Icon name="plus" /></span>
        <div><h2>모브인 물류</h2><p><em>화주</em> 화주 계정 · SHIPPER-0001</p></div>
        <button type="button">회사 정보 수정</button>
      </section>

      <div className="profile-layout-v3">
        <div className="profile-layout-v3__main">
          <section className="profile-preference-card panel-v3">
            <div className="section-heading-v3"><Icon name="shield" /><div><h2>내 선호 조건</h2><p>콜 등록과 조건 비교의 기본 판단 기준</p></div><button onClick={onEditPreferences} type="button">선호 조건 수정</button></div>
            <dl>{preferenceGroups.map((group) => <div key={group.id}><dt>{group.shortTitle}</dt><dd>{preferences[group.id].length ? preferences[group.id].join(' · ') : '미설정'}</dd></div>)}</dl>
          </section>

          <section className="data-scope-card panel-v3">
            <div className="section-heading-v3"><Icon name="info" /><div><h2>사용 데이터와 분석 범위</h2><p>원자료, 가상 표본, 이번 브라우저 기록을 구분합니다.</p></div></div>
            <div className="data-source-list">
              <div><Icon name="chart" size={19} /><span><strong>기획자료 최종</strong><small>3h↔48h 조건 비교 끝점 · 신뢰도 78%</small></span><em>자료 근거</em></div>
              <div><Icon name="leaf" size={19} /><span><strong>탄소배출 산정식 국내계수판</strong><small>방식 B · 경유 2.609kgCO₂/L</small></span><em>공식계수</em></div>
              <div><Icon name="users" size={19} /><span><strong>12,000건 가상 오더</strong><small>탄소 집계와 톤급별 참조</small></span><em>가상 표본</em></div>
              <div><Icon name="clock" size={19} /><span><strong>최근 데모 선택 기록</strong><small>선호 조건, 콜 정보, 최근 선택</small></span><em>로컬 저장</em></div>
            </div>
          </section>

          <section className="profile-metrics-v3"><article><Icon name="chart" /><span>분석 콜</span><strong>12,000건</strong></article><article><Icon name="clock" /><span>시간 제안</span><strong>{timeProposalCount}건</strong></article><article><Icon name="spark" /><span>Gemini 분석</span><strong>{timeProposalCount ? '1회' : '대기'}</strong></article></section>
        </div>

        <aside className="profile-layout-v3__side">
          <section className="profile-operations panel-v3">
            <div className="section-heading-v3"><Icon name="clock" /><div><h2>최근 운영 기록</h2><p>이번 기기의 데모 흐름</p></div></div>
            <ol>{operations.length ? operations.slice(0, 6).map((operation, index) => <li key={operation.id}><span>{index + 1}</span><div><strong>{operation.title}</strong><small>{operation.time} · {operation.detail}</small></div></li>) : <li className="is-empty"><span>1</span><div><strong>기록 대기</strong><small>선호 조건을 저장하면 기록이 시작됩니다.</small></div></li>}</ol>
          </section>

          <section className="ai-settings-card panel-v3">
            <div className="section-heading-v3"><Icon name="spark" /><div><h2>AI 및 계산 설정</h2><p>배포 환경에서 모델 키를 연결합니다.</p></div></div>
            <dl><div><dt>자료 해석 모델</dt><dd>Gemini 3.6 Flash</dd></div><div><dt>탄소 산정</dt><dd>국내계수판 방식 B</dd></div><div><dt>API 키</dt><dd>배포 환경 변수</dd></div></dl>
            <p><Icon name="info" size={16} /> 화물 조건과 집계 지표만 AI 요약에 사용합니다.</p>
          </section>
        </aside>
      </div>

      <div className="profile-report-action"><button onClick={onOpenReport} type="button"><Icon name="chart" size={18} /> 데이터 리포트 열기</button></div>
    </div>
  )
}
