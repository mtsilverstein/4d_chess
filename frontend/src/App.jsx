import { useEffect, useRef, useState } from 'react'
import { createGame, key, VALUES } from './engine'
import Universe from './Universe'

const SYMBOLS = { King: '♚', Queen: '♛', Rook: '♜', Bishop: '♝', Knight: '♞', Pawn: '♟' }
const coordinate = (pos) => `(${pos.join(', ')})`
const endings = {
  checkmate: 'Checkmate',
  stalemate: 'Draw · stalemate',
  repetition: 'Draw · repetition',
  'fifty-move': 'Draw · fifty-move rule',
  insufficient: 'Draw · kings only',
  'move-limit': 'Complete · 500-ply limit',
}

export default function App() {
  const [game, setGame] = useState(createGame)
  const [heat, setHeat] = useState({})
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [speed, setSpeed] = useState(1400)
  const [rotate, setRotate] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [showNodes, setShowNodes] = useState(true)
  const [showHeat, setShowHeat] = useState(false)
  const [slice, setSlice] = useState([0, 0])
  const [follow, setFollow] = useState(true)
  const [selected, setSelected] = useState(null)
  const [about, setAbout] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const worker = useRef(null)
  const generation = useRef(0)
  const pending = useRef(false)
  const dialog = useRef(null)
  const lastMove = game.history.at(-1)
  const activeSlice = follow && lastMove ? [lastMove.end[2], lastMove.end[3]] : slice

  useEffect(() => {
    const instance = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })
    worker.current = instance
    instance.onmessage = ({ data }) => {
      if (data.generation !== generation.current) return
      pending.current = false
      setBusy(false)
      if (data.error) {
        setError(data.error)
        setRunning(false)
        return
      }
      setGame(data.game)
      setHeat(data.heat)
      setReady(true)
      if (data.game.status !== 'playing') setRunning(false)
    }
    instance.onerror = () => {
      pending.current = false
      setBusy(false)
      setError('The simulation worker stopped. Reload the page to restart.')
      setRunning(false)
    }
    instance.postMessage({ type: 'state', generation: generation.current })
    return () => {
      instance.terminate()
      worker.current = null
    }
  }, [])

  function step() {
    if (!worker.current || pending.current || game.status !== 'playing') return
    pending.current = true
    setBusy(true)
    worker.current.postMessage({ type: 'step', generation: generation.current })
  }

  useEffect(() => {
    if (!running || !ready || busy || game.status !== 'playing') return
    const timer = setTimeout(() => {
      if (document.hidden || pending.current) return
      pending.current = true
      setBusy(true)
      worker.current?.postMessage({ type: 'step', generation: generation.current })
    }, speed)
    return () => clearTimeout(timer)
  }, [running, ready, busy, speed, game])

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setRunning(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setImmersive(false)
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('keydown', escape)
    }
  }, [])

  useEffect(() => {
    if (about) dialog.current?.showModal()
    else dialog.current?.close()
  }, [about])

  function reset() {
    generation.current++
    pending.current = true
    setBusy(true)
    setRunning(false)
    setSelected(null)
    setSlice([0, 0])
    setError('')
    worker.current?.postMessage({ type: 'reset', generation: generation.current })
  }

  const piece = game.pieces.find((p) => p.id === selected)
  const slicePieces = game.pieces.filter(
    (p) => p.pos[2] === activeSlice[0] && p.pos[3] === activeSlice[1],
  )
  const occupied = new Set(game.pieces.map((p) => `${p.pos[2]},${p.pos[3]}`)).size
  const material = (color) =>
    game.pieces.filter((p) => p.color === color).reduce((sum, p) => sum + VALUES[p.type], 0)
  const whiteMaterial = material('white'),
    blackMaterial = material('black')

  return (
    <div className={`app ${immersive ? 'immersive' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Tesseract home">
          <span className="brand-mark">◇</span> TESSERACT <span className="brand-divider" />
          <span className="brand-sub">FOUR-DIMENSIONAL CHESS</span>
        </a>
        <button className="text-button" onClick={() => setAbout(true)}>
          The experiment <span>↗</span>
        </button>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-line" /> AN EXPERIMENT IN SPACE & STRATEGY
            </div>
            <h1>
              Chess, beyond
              <br />
              <em>the board.</em>
            </h1>
            <p>32 pieces. Four axes. A different kind of possibility.</p>
          </div>
          <div className="intro-note">
            <span>01 — THE OBSERVATORY</span>
            <p>
              Watch two algorithms navigate a world
              <br />
              with one more dimension than ours.
            </p>
          </div>
        </section>
        <div className="workspace">
          <section
            className="observatory"
            aria-label="Interactive four-dimensional chess projection"
          >
            <div className="scene-heading">
              <span className="eyebrow">4D → 3D → 2D PROJECTION</span>
              <span className={`status ${running ? 'live' : ''}`}>
                <i />
                {!ready ? 'INITIALIZING' : busy ? 'COMPUTING' : running ? 'SIMULATING' : 'PAUSED'}
              </span>
            </div>
            <Universe
              pieces={game.pieces}
              lastMove={lastMove}
              rotate={rotate}
              showNodes={showNodes}
              showHeat={showHeat}
              heat={heat}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="scene-caption">
              <span className="axis-label">
                X <b>Y</b> Z <b>W</b>
              </span>
              <span>Drag to orbit · Scroll to zoom · Select a piece</span>
            </div>
            <div className="scene-stats">
              <div>
                <strong>4,096</strong>
                <span>COORDINATES</span>
              </div>
              <div>
                <strong>
                  {String(occupied).padStart(2, '0')}
                  <small> / 64</small>
                </strong>
                <span>OCCUPIED PLANES</span>
              </div>
              <div>
                <strong data-testid="ply">{String(game.ply).padStart(3, '0')}</strong>
                <span>HALF-MOVES</span>
              </div>
            </div>
            <button
              className="expand-button"
              onClick={() => setImmersive(!immersive)}
              aria-label={immersive ? 'Exit immersive view' : 'Enter immersive view'}
              title={immersive ? 'Exit immersive view (Esc)' : 'Immersive view'}
            >
              {immersive ? '↙' : '↗'}
            </button>
          </section>
          <aside className="inspector">
            <div className="panel-title">
              <h2>The simulation</h2>
              <span className="index">01 / LIVE STATE</span>
            </div>
            <div className="turn-row">
              <span className={`side-dot ${game.turn}`} />
              <strong>
                {endings[game.status] || `${game.turn === 'white' ? 'Ivory' : 'Copper'} to move`}
              </strong>
              {game.check && game.status === 'playing' && <span className="check">CHECK</span>}
              <span className="cpu">CPU × CPU</span>
            </div>
            <div className="playback">
              <button
                className="primary-button"
                disabled={!ready || !!error || game.status !== 'playing'}
                onClick={() => setRunning(!running)}
              >
                {running ? 'Ⅱ Pause' : '▶ Play simulation'}
              </button>
              <button
                className="icon-button"
                disabled={!ready || busy || running || !!error || game.status !== 'playing'}
                onClick={step}
                aria-label="Advance one move"
                title="Advance one move"
              >
                ↦
              </button>
              <button
                className="icon-button"
                disabled={!ready}
                onClick={reset}
                aria-label="Reset simulation"
                title="Reset simulation"
              >
                ↺
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="speed-row">
              <label htmlFor="speed">Pace</label>
              <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={2600}>Contemplative · 2.6s</option>
                <option value={1400}>Balanced · 1.4s</option>
                <option value={450}>Rapid · 0.45s</option>
              </select>
            </div>
            <div className="slice-heading">
              <h2>Plane inspector</h2>
              <label className="follow">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => {
                    setSlice(activeSlice)
                    setFollow(e.target.checked)
                  }}
                />{' '}
                Follow move
              </label>
            </div>
            <div className="slice-controls">
              {['Z', 'W'].map((axis, i) => (
                <label key={axis}>
                  {axis}
                  <select
                    aria-label={`${axis} plane`}
                    value={activeSlice[i]}
                    onChange={(e) => {
                      const next = [...activeSlice]
                      next[i] = Number(e.target.value)
                      setSlice(next)
                      setFollow(false)
                    }}
                  >
                    {Array.from({ length: 8 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <span>{slicePieces.length} pieces in this plane</span>
            </div>
            <div className="board-wrap">
              <div className="rank-labels">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <div
                className="slice-board"
                aria-label={`XY board at Z ${activeSlice[0]}, W ${activeSlice[1]}`}
              >
                {Array.from({ length: 64 }, (_, n) => {
                  const x = n % 8,
                    y = 7 - Math.floor(n / 8),
                    pos = [x, y, ...activeSlice]
                  const p = slicePieces.find((p) => p.pos[0] === x && p.pos[1] === y)
                  const last =
                    lastMove && (key(lastMove.start) === key(pos) || key(lastMove.end) === key(pos))
                  const pressure = heat[key(pos)]
                  return (
                    <button
                      key={n}
                      className={`cell ${(x + y) % 2 ? 'dark' : ''} ${p?.color || ''} ${last ? 'last' : ''} ${p && selected === p.id ? 'selected' : ''}`}
                      onClick={() => setSelected(p?.id || null)}
                      aria-label={`${coordinate(pos)}${p ? ` ${p.color} ${p.type}` : ' empty'}`}
                      title={`${coordinate(pos)}${p ? ` · ${p.color} ${p.type}` : ''}`}
                      style={
                        showHeat && pressure
                          ? {
                              boxShadow: `inset 0 0 0 20px rgba(114,161,141,${Math.min(0.5, (pressure.white + pressure.black) * 0.09)})`,
                            }
                          : undefined
                      }
                    >
                      {p ? SYMBOLS[p.type] : ''}
                    </button>
                  )
                })}
              </div>
              <div className="file-labels">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
            <div className="piece-detail" aria-live="polite">
              {piece ? (
                <>
                  <span className={piece.color}>{SYMBOLS[piece.type]}</span>
                  <div>
                    <strong>
                      {piece.color === 'white' ? 'Ivory' : 'Copper'} {piece.type.toLowerCase()}
                    </strong>
                    <small>[x, y, z, w] = {coordinate(piece.pos)}</small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSlice(piece.pos.slice(2))
                      setFollow(false)
                    }}
                  >
                    Locate ↗
                  </button>
                </>
              ) : (
                <>
                  <span>⌖</span>
                  <p>Select a piece to inspect its coordinates.</p>
                </>
              )}
            </div>
          </aside>
        </div>
        <div className="lower-grid">
          <section className="lower-panel">
            <div className="panel-title">
              <h2>Set the atmosphere</h2>
              <span className="index">02 / DISPLAY</span>
            </div>
            <div className="toggles">
              {[
                [rotate, setRotate, 'Rotate through 4D'],
                [showNodes, setShowNodes, 'Coordinate lattice'],
                [showHeat, setShowHeat, 'Attack pressure'],
              ].map(([value, setter, label]) => (
                <label key={label} className="toggle-row">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                  />
                  <span className="switch" />
                </label>
              ))}
            </div>
            <p className="muted">Projection motion is independent of game playback.</p>
          </section>
          <section className="lower-panel">
            <div className="panel-title">
              <h2>Balance of power</h2>
              <span className="index">03 / MATERIAL</span>
            </div>
            <div className="material-labels">
              <span>
                <i className="side-dot white" /> Ivory <b>{whiteMaterial}</b>
              </span>
              <span>
                <b>{blackMaterial}</b> Copper <i className="side-dot black" />
              </span>
            </div>
            <div className="material-bar">
              <div
                style={{
                  width: `${whiteMaterial + blackMaterial ? (whiteMaterial / (whiteMaterial + blackMaterial)) * 100 : 50}%`,
                }}
              />
            </div>
            <div className="material-labels muted">
              <span>{game.pieces.filter((p) => p.color === 'white').length} pieces</span>
              <span>{game.pieces.filter((p) => p.color === 'black').length} pieces</span>
            </div>
            <p className="muted">Material only. Position can tell a different story.</p>
          </section>
          <section className="lower-panel">
            <div className="panel-title">
              <h2>Across dimensions</h2>
              <span className="index">04 / MOVE LOG</span>
            </div>
            <div className="move-list" aria-label="Recent moves">
              {game.history.length ? (
                game.history
                  .slice(-4)
                  .reverse()
                  .map((move, i) => (
                    <div className="move-row" key={game.ply - i}>
                      <span className="move-number">{String(game.ply - i).padStart(3, '0')}</span>
                      <span className={`move-symbol ${move.color}`}>{SYMBOLS[move.type]}</span>
                      <span title={`${coordinate(move.start)} → ${coordinate(move.end)}`}>
                        {move.start.join('')} <b>→</b> {move.end.join('')}
                        {move.promotion ? ' = Q' : move.captured ? ' ×' : ''}
                      </span>
                      <span className="move-dimension">
                        {move.start[3] !== move.end[3]
                          ? 'W shift'
                          : move.start[2] !== move.end[2]
                            ? 'Z shift'
                            : 'XY plane'}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="empty-log">
                  <span>↗</span>
                  <p>
                    Every move opens another direction.
                    <br />
                    Press play to begin the experiment.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
        <footer>
          <span>A familiar game. An unfamiliar geometry.</span>
          <span>
            REACT · WEB WORKERS · 4D MATHEMATICS <span className="footer-star">✳</span>
          </span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        aria-labelledby="experiment-title"
        onCancel={() => setAbout(false)}
        onClose={() => setAbout(false)}
      >
        <button
          className="dialog-close icon-button"
          onClick={() => setAbout(false)}
          aria-label="Close explanation"
        >
          ×
        </button>
        <div className="eyebrow">THE EXPERIMENT</div>
        <h2>
          <span id="experiment-title">One more dimension.</span>
          <br />
          Many more possibilities.
        </h2>
        <p>
          Tesseract is an autonomous chess variant on an 8 × 8 × 8 × 8 grid. Each square has four
          coordinates: <strong>[x, y, z, w]</strong>. The inspector fixes Z and W to show one
          familiar XY board out of 64.
        </p>
        <h3>How pieces travel</h3>
        <ul>
          <li>
            <strong>Rook:</strong> slides along one of the four axes.
          </li>
          <li>
            <strong>Bishop:</strong> slides equally along exactly two axes.
          </li>
          <li>
            <strong>Queen:</strong> slides equally along any combination of axes.
          </li>
          <li>
            <strong>Knight:</strong> jumps two cells on one axis and one on another.
          </li>
          <li>
            <strong>King:</strong> moves one cell along any combination of axes, safely.
          </li>
          <li>
            <strong>Pawn:</strong> advances along Y, captures along Y plus one other axis, and
            promotes to queen at the opposite Y edge.
          </li>
        </ul>
        <p>
          Ivory starts at Z = W = 0; Copper at Z = W = 7. Kings cannot move into check. Checkmate,
          stalemate, threefold repetition, fifty quiet moves per side, and kings-only draws end the
          game. A 500-half-move cap bounds the experiment. This variant has no castling or en
          passant.
        </p>
        <h3>What you’re seeing</h3>
        <p>
          Successive rotations in the XW and ZW planes feed a 4D perspective projection into 3D,
          then a camera projects that onto your screen. Apparent overlaps can be far apart in four
          dimensions. The lattice represents all 4,096 coordinates; bright rings mark the last move.
        </p>
        <p>
          Attack pressure shows geometric attacks from both sides, including defended squares and
          pinned pieces. The CPU uses a one-ply heuristic for material, safety, and central
          development with a little randomness. It is an exploration, not a competitive chess
          engine.
        </p>
        <div className="dialog-note">
          Runs locally in your browser. No account, server, or external data feed.
        </div>
      </dialog>
    </div>
  )
}
