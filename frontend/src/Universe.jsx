import { useEffect, useRef } from 'react'
import { corners, edges, nodes, project4D } from './projection'
import { key } from './engine'

const symbols = { King: '♚', Queen: '♛', Rook: '♜', Bishop: '♝', Knight: '♞', Pawn: '♟' }

export default function Universe(props) {
  const canvas = useRef(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  }, [props])
  useEffect(() => {
    const element = canvas.current,
      ctx = element.getContext('2d')
    if (!ctx) return
    let width = 0,
      height = 0,
      frame,
      previous = 0,
      angle = 0.42
    let yaw = -0.42,
      pitch = 0.23,
      zoom = 1,
      dragging = null,
      moved = false
    let hitTargets = []
    const transitions = new Map()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
      height = entry.contentRect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(width * dpr)
      element.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    })
    resize.observe(element)
    function project(pos) {
      const [x, y, z] = project4D(pos, angle)
      const u = x * Math.cos(yaw) - z * Math.sin(yaw)
      const depth = x * Math.sin(yaw) + z * Math.cos(yaw)
      const v = y * Math.cos(pitch) - depth * Math.sin(pitch)
      const d = y * Math.sin(pitch) + depth * Math.cos(pitch)
      const perspective = 30 / (30 + d)
      const scale = Math.min(width / 20, height / 17) * zoom
      return [
        width / 2 + u * scale * perspective,
        height / 2 - v * scale * perspective - 4,
        d,
        perspective,
      ]
    }
    function line(a, b, color, lineWidth = 1) {
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
    function draw(time) {
      frame = requestAnimationFrame(draw)
      const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0
      previous = time
      if (document.hidden || !width) return
      const { pieces, lastMove, rotate, showNodes, showHeat, heat, selected } = latest.current
      if (rotate) angle += dt * 0.075
      ctx.clearRect(0, 0, width, height)
      const projected = corners.map(project)
      for (const [a, b] of edges)
        line(projected[a], projected[b], (a ^ b) === 8 ? '#739a8960' : '#b399714c')
      if (showNodes || showHeat)
        for (const pos of nodes) {
          const h = showHeat ? heat[key(pos)] : null
          if (!showNodes && !h) continue
          const [x, y, depth] = project(pos)
          ctx.fillStyle = h
            ? `rgba(143,191,162,${Math.min(0.8, 0.18 + (h.white + h.black) * 0.12)})`
            : `rgba(177,184,171,${depth > 0 ? 0.13 : 0.25})`
          const size = h ? 1.7 : 0.85
          ctx.fillRect(x, y, size, size)
        }
      if (lastMove) {
        const a = project(lastMove.start),
          b = project(lastMove.end)
        ctx.setLineDash([4, 5])
        line(a, b, '#dad1a5a0', 1.3)
        ctx.setLineDash([])
        for (const p of [a, b]) {
          ctx.beginPath()
          ctx.arc(p[0], p[1], 10, 0, Math.PI * 2)
          ctx.strokeStyle = '#d8cba076'
          ctx.stroke()
        }
      }
      for (const id of transitions.keys())
        if (!pieces.some((p) => p.id === id)) transitions.delete(id)
      hitTargets = pieces
        .map((p) => {
          let transition = transitions.get(p.id)
          if (!transition) {
            transition = { end: p.pos, from: p.pos, current: p.pos, time }
            transitions.set(p.id, transition)
          }
          if (key(transition.end) !== key(p.pos)) {
            transition.from = transition.current
            transition.end = p.pos
            transition.time = time
          }
          const progress = reducedMotion.matches ? 1 : Math.min(1, (time - transition.time) / 420)
          const eased = progress * progress * (3 - 2 * progress)
          transition.current = transition.from.map((v, i) => v + (transition.end[i] - v) * eased)
          return { p, screen: project(transition.current) }
        })
        .sort((a, b) => b.screen[2] - a.screen[2])
      for (const {
        p,
        screen: [x, y, , scale],
      } of hitTargets) {
        const color = p.color === 'white' ? '#eee7d3' : '#cf936e'
        const radius = Math.max(7, 10 * scale * Math.sqrt(zoom))
        ctx.shadowColor = color
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.ellipse(x, y + radius * 0.7, radius * 0.85, radius * 0.3, 0, 0, Math.PI * 2)
        ctx.strokeStyle = p.color === 'white' ? '#eee7d377' : '#cf936e99'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.font = `${radius * 2.2}px "Segoe UI Symbol", "DejaVu Sans", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(symbols[p.type], x, y - radius * 0.15)
        ctx.shadowBlur = 0
        if (p.id === selected) {
          ctx.beginPath()
          ctx.arc(x, y, radius + 7, 0, Math.PI * 2)
          ctx.strokeStyle = '#afc8b6'
          ctx.stroke()
        }
      }
      projected.forEach(([x, y], i) => {
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = '#9da78b'
        ctx.fill()
        if (i === 0 || i === 15) {
          ctx.font = '10px monospace'
          ctx.fillStyle = '#8d9385'
          ctx.fillText(i === 0 ? '0000' : '7777', x, y + 16)
        }
      })
    }
    const down = (event) => {
      dragging = [event.clientX, event.clientY]
      moved = false
      element.setPointerCapture(event.pointerId)
    }
    const move = (event) => {
      if (!dragging) return
      const dx = event.clientX - dragging[0],
        dy = event.clientY - dragging[1]
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
      yaw += dx * 0.006
      pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.006))
      dragging = [event.clientX, event.clientY]
    }
    const up = (event) => {
      if (!dragging) return
      dragging = null
      if (moved) return
      const rect = element.getBoundingClientRect(),
        x = event.clientX - rect.left,
        y = event.clientY - rect.top
      const target = [...hitTargets]
        .reverse()
        .find(({ screen }) => Math.hypot(screen[0] - x, screen[1] - y) < 18)
      latest.current.onSelect(target?.p.id || null)
    }
    const cancel = () => {
      dragging = null
    }
    const wheel = (event) => {
      event.preventDefault()
      zoom = Math.max(0.6, Math.min(2.2, zoom * Math.exp(-event.deltaY * 0.001)))
    }
    const keyboard = (event) => {
      if (
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(
          event.key,
        )
      )
        return
      event.preventDefault()
      if (event.key === 'ArrowLeft') yaw -= 0.1
      if (event.key === 'ArrowRight') yaw += 0.1
      if (event.key === 'ArrowUp') pitch = Math.min(1.3, pitch + 0.1)
      if (event.key === 'ArrowDown') pitch = Math.max(-1.3, pitch - 0.1)
      if (event.key === '+' || event.key === '=') zoom = Math.min(2.2, zoom + 0.1)
      if (event.key === '-') zoom = Math.max(0.6, zoom - 0.1)
      if (event.key === 'Home') {
        yaw = -0.42
        pitch = 0.23
        zoom = 1
      }
    }
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', cancel)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('keydown', keyboard)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', cancel)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('keydown', keyboard)
    }
  }, [])
  return (
    <canvas
      ref={canvas}
      className="universe"
      tabIndex={0}
      aria-label="4D chess projection. Use arrow keys to orbit, plus and minus to zoom, and Home to reset the camera. Inspect pieces using the plane inspector."
    />
  )
}
