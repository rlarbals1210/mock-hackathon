export type CarrierStage =
  | 'base-profile'
  | 'preferences'
  | 'home'
  | 'candidates'
  | 'route-map'
  | 'backhaul-decision'
  | 'summary'

export type NotificationKind = 'ai-candidate' | 'backhaul' | null

export const carrierStageLabels: Record<CarrierStage, string> = {
  'base-profile': '기본 조건 확인',
  preferences: '선호 조건 설정',
  home: '오더 게시판',
  candidates: '콜 후보 비교',
  'route-map': '이동 경로',
  'backhaul-decision': '복화 콜 결정',
  summary: '운행 리포트',
}
