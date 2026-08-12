import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatMinutes, getWindowHours } from './shipperModel'

type Handle = 'start' | 'end'

type TimeWindowDialProps = {
  startMinutes: number | null
  endMinutes: number | null
  onChange: (startMinutes: number, endMinutes: number) => void
}

const size = 300
const center = size / 2
const radius = 103

function pointForMinutes(minutes: number) {
  const radians = (minutes / 1440) * Math.PI * 2 - Math.PI / 2
  return {
    x: center + Math.cos(radians) * radius,
    y: center + Math.sin(radians) * radius,
  }
}

function polarMinutes(x: number, y: number) {
  const angle = Math.atan2(y - center, x - center) + Math.PI / 2
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2)
  return (Math.round(((normalized / (Math.PI * 2)) * 1440) / 30) * 30) % 1440
}

function arcPath(startMinutes: number, endMinutes: number) {
  const start = pointForMinutes(startMinutes)
  const end = pointForMinutes(endMinutes)
  const duration = (endMinutes - startMinutes + 1440) % 1440 || 1440
  const largeArc = duration > 720 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function TimeWindowDial({ startMinutes, endMinutes, onChange }: TimeWindowDialProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<Handle | null>(null)
  const start = startMinutes ?? 540
  const end = endMinutes ?? 720
  const duration = getWindowHours(start, end) ?? 3

  const updateFromPointer = (event: ReactPointerEvent<SVGSVGElement>, handle: Handle) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((event.clientX - rect.left) / rect.width) * size
    const y = ((event.clientY - rect.top) / rect.height) * size
    const minutes = polarMinutes(x, y)
    if (handle === 'start') onChange(minutes, end)
    else onChange(start, minutes)
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((event.clientX - rect.left) / rect.width) * size
    const y = ((event.clientY - rect.top) / rect.height) * size
    const startPoint = pointForMinutes(start)
    const endPoint = pointForMinutes(end)
    const startDistance = Math.hypot(x - startPoint.x, y - startPoint.y)
    const endDistance = Math.hypot(x - endPoint.x, y - endPoint.y)
    const handle: Handle = startDistance <= endDistance ? 'start' : 'end'
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(handle)
    updateFromPointer(event, handle)
  }

  const labels = [0, 3, 6, 9, 12, 15, 18, 21]
  const startPoint = pointForMinutes(start)
  const endPoint = pointForMinutes(end)

  return (
    <div className="time-dial">
      <div className="time-dial__presets" aria-label="상차 시간 빠른 선택">
        {[
          ['오전', 360, 720],
          ['오후', 720, 1080],
          ['야간', 1080, 360],
        ].map(([label, presetStart, presetEnd]) => (
          <button key={label} onClick={() => onChange(Number(presetStart), Number(presetEnd))} type="button">{label}</button>
        ))}
      </div>
      <svg
        aria-label={`상차 시간 ${formatMinutes(start)}부터 ${formatMinutes(end)}까지`}
        className="time-dial__svg"
        onPointerDown={onPointerDown}
        onPointerMove={(event) => dragging && updateFromPointer(event, dragging)}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          setDragging(null)
        }}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle className="time-dial__track" cx={center} cy={center} r={radius} />
        <path className="time-dial__range" d={arcPath(start, end)} />
        {Array.from({ length: 24 }, (_, hour) => {
          const outer = pointForMinutes(hour * 60)
          const innerRadius = hour % 3 === 0 ? radius - 12 : radius - 6
          const radians = (hour / 24) * Math.PI * 2 - Math.PI / 2
          const inner = {
            x: center + Math.cos(radians) * innerRadius,
            y: center + Math.sin(radians) * innerRadius,
          }
          return <line className={hour % 3 === 0 ? 'is-major' : ''} key={hour} x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />
        })}
        {labels.map((hour) => {
          const radians = (hour / 24) * Math.PI * 2 - Math.PI / 2
          const labelRadius = radius + 25
          return (
            <text key={hour} x={center + Math.cos(radians) * labelRadius} y={center + Math.sin(radians) * labelRadius + 4}>
              {String(hour).padStart(2, '0')}
            </text>
          )
        })}
        <circle className="time-dial__handle" cx={startPoint.x} cy={startPoint.y} r="10" />
        <circle className="time-dial__handle" cx={endPoint.x} cy={endPoint.y} r="10" />
        <text className="time-dial__center-label" x={center} y={center - 7}>{formatMinutes(start)} ~ {formatMinutes(end)}</text>
        <text className="time-dial__center-sub" x={center} y={center + 20}>{duration.toFixed(duration % 1 ? 1 : 0)}시간</text>
      </svg>
      <div className="time-dial__values">
        <label>시작 시간<input aria-label="상차 시작 시간" max="1410" min="0" onChange={(event) => onChange(Number(event.target.value), end)} step="30" type="range" value={start} /><strong>{formatMinutes(start)}</strong></label>
        <label>종료 시간<input aria-label="상차 종료 시간" max="1410" min="0" onChange={(event) => onChange(start, Number(event.target.value))} step="30" type="range" value={end} /><strong>{formatMinutes(end)}</strong></label>
      </div>
      {startMinutes === null && <p className="time-dial__hint">다이얼을 드래그하거나 시간대를 선택하면 등록 정보에 반영됩니다.</p>}
    </div>
  )
}
