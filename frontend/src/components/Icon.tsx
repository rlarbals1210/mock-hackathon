import type { SVGProps } from 'react'

export type IconName =
  | 'bell'
  | 'calendar'
  | 'account'
  | 'balance'
  | 'chart'
  | 'chat'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'clipboard-plus'
  | 'compare'
  | 'dashboard'
  | 'fuel'
  | 'help'
  | 'info'
  | 'leaf'
  | 'location'
  | 'plus'
  | 'profile'
  | 'report'
  | 'route'
  | 'shield'
  | 'sliders'
  | 'spark'
  | 'switch'
  | 'truck'
  | 'users'
  | 'wallet'

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number
}

export function Icon({ name, size = 24, ...props }: IconProps) {
  const glyph = (() => {
    switch (name) {
      case 'account':
        return <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6.8 18a6 6 0 0 1 10.4 0"/></>
      case 'balance':
        return <><path d="M12 3v18M5 6h14M4 21h16"/><path d="m7 6-4 7h8L7 6Zm10 0-4 7h8l-4-7Z"/><path d="M3 13a4 4 0 0 0 8 0M13 13a4 4 0 0 0 8 0"/></>
      case 'bell':
        return <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>
      case 'calendar':
        return <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>
      case 'chart':
        return <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>
      case 'chat':
        return <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M7 8h10M7 12h7"/></>
      case 'check':
        return <path d="m5 12 4 4L19 6"/>
      case 'chevron':
        return <path d="m9 18 6-6-6-6"/>
      case 'clock':
        return <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>
      case 'clipboard-plus':
        return <><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M12 10v6M9 13h6"/></>
      case 'compare':
        return <><path d="M7 7h12l-3-3M17 17H5l3 3"/><path d="m19 7-3 3M5 17l3-3"/></>
      case 'dashboard':
        return <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>
      case 'fuel':
        return <><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M2 21h16M7 7h6v5H7zM16 8h2l2 3v6a2 2 0 0 0 2 2"/></>
      case 'help':
        return <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.8 1.2-1.8 2.7M12 17h.01"/></>
      case 'info':
        return <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>
      case 'leaf':
        return <><path d="M20 4C12 4 5 7 5 14c0 3 2 5 5 5 7 0 9-8 10-15Z"/><path d="M4 21c3-6 7-9 12-12"/></>
      case 'location':
        return <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>
      case 'plus':
        return <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></>
      case 'profile':
        return <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>
      case 'report':
        return <><path d="M5 3h10l4 4v14H5zM15 3v5h4"/><path d="M9 17v-3M12 17v-6M15 17v-4"/></>
      case 'route':
        return <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h4a3 3 0 0 1 3 3v8a3 3 0 0 0 3 3"/></>
      case 'shield':
        return <><path d="M12 3 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>
      case 'sliders':
        return <><path d="M4 6h6M14 6h6M4 12h11M19 12h1M4 18h2M10 18h10"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></>
      case 'spark':
        return <><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>
      case 'switch':
        return <><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="m18 7-3 3M6 17l3-3"/></>
      case 'truck':
        return <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>
      case 'users':
        return <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>
      case 'wallet':
        return <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M16 11h6v4h-6a2 2 0 0 1 0-4Z"/></>
    }
  })()

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {glyph}
    </svg>
  )
}
