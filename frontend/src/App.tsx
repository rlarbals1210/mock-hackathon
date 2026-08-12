import { useState } from 'react'
import './App.css'
import { Icon, type IconName } from './components/Icon'
import { RoleSwitch, type UserRole } from './components/RoleSwitch'
import { CarrierWorkspace } from './features/carrier/CarrierWorkspace'
import { ShipperScreen, type ShipperSection } from './features/shipper/ShipperScreens'

const shipperNavigation: { id: ShipperSection; label: string; icon: IconName }[] = [
  { id: 'preferences', label: '필수 설정', icon: 'sliders' },
  { id: 'register', label: '콜 등록', icon: 'clipboard-plus' },
  { id: 'compare', label: '조건 비교', icon: 'balance' },
  { id: 'report', label: '월간 리포트', icon: 'report' },
  { id: 'profile', label: '내 정보', icon: 'account' },
]

function Brand() {
  return (
    <div className="brand-block">
      <strong>Mov!n</strong>
      <span>물류의 이동을 쉽게</span>
    </div>
  )
}

function Sidebar({ section, onNavigate }: { section: ShipperSection; onNavigate: (section: ShipperSection) => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="화주·주선사 메뉴">
        {shipperNavigation.map((item) => (
          <button className={section === item.id ? 'is-active' : ''} key={item.id} onClick={() => onNavigate(item.id)} type="button">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-profile">
        <span className="avatar">화</span>
        <span><small>화주 계정</small><strong>화주 계정</strong></span>
        <Icon name="chevron" size={18} />
      </div>
    </aside>
  )
}

function ShipperHeader({ role, onRoleChange }: { role: UserRole; onRoleChange: (role: UserRole) => void }) {
  return (
    <header className="top-header">
      <div className="mobile-brand"><Brand /></div>
      <div className="header-spacer" />
      <RoleSwitch onChange={onRoleChange} role={role} />
    </header>
  )
}

function MobileShipperNav({ section, onNavigate }: { section: ShipperSection; onNavigate: (section: ShipperSection) => void }) {
  return (
    <nav className="mobile-shipper-nav" aria-label="모바일 화주 메뉴">
      {shipperNavigation.map((item) => (
        <button className={section === item.id ? 'is-active' : ''} key={item.id} onClick={() => onNavigate(item.id)} type="button">
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function App() {
  const [role, setRole] = useState<UserRole>('shipper')
  const [shipperSection, setShipperSection] = useState<ShipperSection>('preferences')

  const changeRole = (nextRole: UserRole) => {
    setRole(nextRole)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const navigateShipper = (section: ShipperSection) => {
    setShipperSection(section)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  if (role === 'carrier') {
    return <CarrierWorkspace onReturnToShipper={() => changeRole('shipper')} />
  }

  return (
    <div className="app-shell">
      <Sidebar onNavigate={navigateShipper} section={shipperSection} />
      <div className="shipper-shell">
        <ShipperHeader onRoleChange={changeRole} role={role} />
        <main className="shipper-main">
          <ShipperScreen onNavigate={navigateShipper} section={shipperSection} />
        </main>
      </div>
      <MobileShipperNav onNavigate={navigateShipper} section={shipperSection} />
    </div>
  )
}

export default App
