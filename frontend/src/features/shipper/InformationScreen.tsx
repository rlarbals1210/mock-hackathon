import { Icon } from '../../components/Icon'

type InformationScreenProps = {
  timeProposalCount: number
}

export function InformationScreen({ timeProposalCount }: InformationScreenProps) {
  return (
    <div className="flow-screen information-screen-v3">
      <header className="flow-heading"><div><h1>Information</h1><p>배차 분석에 사용하는 데이터 범위와 계산 설정을 확인할 수 있습니다.</p></div></header>

      <section className="profile-metrics-v3 information-metrics-v3" aria-label="분석 현황">
        <article><Icon name="chart" /><span>분석 콜</span><strong>12,000건</strong></article>
        <article><Icon name="clock" /><span>시간 제안</span><strong>{timeProposalCount}건</strong></article>
        <article><Icon name="spark" /><span>Gemini 분석</span><strong>{timeProposalCount ? '1회' : '대기'}</strong></article>
      </section>

      <div className="information-layout-v3">
        <section className="data-scope-card panel-v3">
          <div className="section-heading-v3"><Icon name="info" /><div><h2>사용 데이터와 분석 범위</h2><p>원자료, 가상 표본, 현재 접속 기록을 구분합니다.</p></div></div>
          <div className="data-source-list">
            <div><Icon name="chart" size={19} /><span><strong>기획자료 최종</strong><small>3h↔48h 조건 비교 끝점 · 신뢰도 78%</small></span><em>자료 근거</em></div>
            <div><Icon name="leaf" size={19} /><span><strong>탄소배출 산정식 국내계수판</strong><small>방식 B · 경유 2.609kgCO₂/L</small></span><em>공식계수</em></div>
            <div><Icon name="users" size={19} /><span><strong>12,000건 가상 오더</strong><small>탄소 집계와 톤급별 참조</small></span><em>가상 표본</em></div>
            <div><Icon name="clock" size={19} /><span><strong>현재 접속 선택 기록</strong><small>선호 조건, 콜 정보, 최근 선택</small></span><em>세션 기록</em></div>
          </div>
        </section>

        <section className="ai-settings-card panel-v3">
          <div className="section-heading-v3"><Icon name="spark" /><div><h2>AI 및 계산 설정</h2><p>배포 환경에서 연결된 분석 설정입니다.</p></div></div>
          <dl><div><dt>자료 해석 모델</dt><dd>Gemini 1.5 Flash</dd></div><div><dt>탄소 산정</dt><dd>국내계수판 방식 B</dd></div><div><dt>API 키</dt><dd>배포 환경 변수</dd></div></dl>
          <p><Icon name="info" size={16} /> 화물 조건과 집계 지표만 AI 요약에 사용합니다.</p>
        </section>
      </div>
    </div>
  )
}
