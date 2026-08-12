export type UserRole = 'shipper' | 'carrier'

type RoleSwitchProps = {
  role: UserRole
  onChange: (role: UserRole) => void
  compact?: boolean
}

export function RoleSwitch({ role, onChange, compact = false }: RoleSwitchProps) {
  return (
    <div className={`role-switch${compact ? ' role-switch--compact' : ''}`} aria-label="사용자 역할 전환">
      <button
        className={role === 'shipper' ? 'is-active' : ''}
        onClick={() => onChange('shipper')}
        type="button"
      >
        화주·주선사
      </button>
      <button
        className={role === 'carrier' ? 'is-active' : ''}
        onClick={() => onChange('carrier')}
        type="button"
      >
        운송인
      </button>
    </div>
  )
}
