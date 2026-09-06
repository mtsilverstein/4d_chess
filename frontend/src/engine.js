// Coordinates are always [x, y, z, w]. A sparse board keeps 4,096 cells cheap.
export const SIZE = 8
export const VALUES = { Pawn: 1, Knight: 3, Bishop: 3.5, Rook: 5, Queen: 9, King: 0 }
export const key = (pos) => pos.join(',')
export const opposite = (color) => (color === 'white' ? 'black' : 'white')
const inside = (pos) => pos.every((n) => n >= 0 && n < SIZE)
const directions = []
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++)
      for (let w = -1; w <= 1; w++) {
        if (x || y || z || w) directions.push([x, y, z, w])
      }
const knights = []
for (let a = 0; a < 4; a++)
  for (let b = 0; b < 4; b++) {
    if (a === b) continue
    for (const s of [-1, 1])
      for (const t of [-1, 1]) {
        const d = [0, 0, 0, 0]
        d[a] = s * 2
        d[b] = t
        knights.push(d)
      }
  }
const vectors = {
  Rook: directions.filter((d) => d.filter(Boolean).length === 1),
  Bishop: directions.filter((d) => d.filter(Boolean).length === 2),
  Queen: directions,
  King: directions,
  Knight: knights,
}

export function initialPieces() {
  const pieces = []
  const back = ['Rook', 'Knight', 'Bishop', 'Queen', 'King', 'Bishop', 'Knight', 'Rook']
  for (const color of ['white', 'black']) {
    const far = color === 'black'
    for (let x = 0; x < 8; x++) {
      pieces.push({
        id: `${color}-${x}`,
        color,
        type: back[x],
        pos: [x, far ? 7 : 0, far ? 7 : 0, far ? 7 : 0],
      })
      pieces.push({
        id: `${color}-p${x}`,
        color,
        type: 'Pawn',
        pos: [x, far ? 6 : 1, far ? 7 : 0, far ? 7 : 0],
      })
    }
  }
  return pieces
}

// Attack maps include defended friendly cells and pawn diagonals, not pawn pushes.
export function targets(piece, board, attacks = false) {
  const result = []
  if (piece.type === 'Pawn') {
    const step = piece.color === 'white' ? 1 : -1
    const forward = [...piece.pos]
    forward[1] += step
    if (!attacks && inside(forward) && !board.has(key(forward))) {
      result.push(forward)
      const double = [...forward]
      double[1] += step
      if (piece.pos[1] === (step === 1 ? 1 : 6) && !board.has(key(double))) result.push(double)
    }
    for (const axis of [0, 2, 3])
      for (const sign of [-1, 1]) {
        const end = [...forward]
        end[axis] += sign
        if (!inside(end)) continue
        const occupant = board.get(key(end))
        if (attacks || (occupant && occupant.color !== piece.color)) result.push(end)
      }
    return result
  }
  const sliding = !['King', 'Knight'].includes(piece.type)
  for (const d of vectors[piece.type]) {
    for (let n = 1; n <= (sliding ? 7 : 1); n++) {
      const end = piece.pos.map((v, i) => v + n * d[i])
      if (!inside(end)) break
      const occupant = board.get(key(end))
      if (!occupant || occupant.color !== piece.color || attacks) result.push(end)
      if (occupant) break
    }
  }
  return result
}

// Test a single square directly instead of expanding all enemy move rays.
export function isAttacked(pos, color, board) {
  for (const p of board.values()) {
    if (p.color === color) continue
    const d = pos.map((v, i) => v - p.pos[i])
    const abs = d.map(Math.abs).filter(Boolean)
    if (!abs.length) continue
    if (p.type === 'Pawn') {
      if (
        d[1] === (p.color === 'white' ? 1 : -1) &&
        [d[0], d[2], d[3]].filter(Boolean).length === 1 &&
        Math.abs(d[0]) + Math.abs(d[2]) + Math.abs(d[3]) === 1
      )
        return true
      continue
    }
    if (p.type === 'Knight') {
      if (abs.length === 2 && abs.includes(1) && abs.includes(2)) return true
      continue
    }
    if (p.type === 'King') {
      if (Math.max(...abs) === 1) return true
      continue
    }
    if (p.type === 'Rook' && abs.length !== 1) continue
    if (p.type === 'Bishop' && abs.length !== 2) continue
    if (!abs.every((v) => v === abs[0])) continue
    let clear = true
    for (let n = 1; n < abs[0]; n++) {
      if (board.has(key(p.pos.map((v, i) => v + Math.sign(d[i]) * n)))) {
        clear = false
        break
      }
    }
    if (clear) return true
  }
  return false
}

export function legalMoves(pieces, color) {
  const board = new Map(pieces.map((p) => [key(p.pos), p]))
  const king = pieces.find((p) => p.color === color && p.type === 'King')
  if (!king) throw new Error(`Missing ${color} king`)
  const moves = []
  for (const p of pieces.filter((p) => p.color === color)) {
    const startKey = key(p.pos)
    for (const end of targets(p, board)) {
      const endKey = key(end),
        captured = board.get(endKey)
      if (captured?.type === 'King') continue
      board.delete(startKey)
      board.set(endKey, { ...p, pos: end })
      if (!isAttacked(p.type === 'King' ? end : king.pos, color, board)) {
        moves.push({
          id: p.id,
          start: p.pos,
          end,
          color,
          type: p.type,
          captured: captured?.type ?? null,
        })
      }
      board.set(startKey, p)
      if (captured) board.set(endKey, captured)
      else board.delete(endKey)
    }
  }
  return moves
}

export function applyMove(pieces, move) {
  return pieces
    .filter((p) => key(p.pos) !== key(move.end))
    .map((p) =>
      p.id !== move.id
        ? p
        : {
            ...p,
            pos: [...move.end],
            type:
              p.type === 'Pawn' && move.end[1] === (p.color === 'white' ? 7 : 0) ? 'Queen' : p.type,
          },
    )
}
export function positionKey(pieces, turn) {
  return `${turn}:${pieces
    .map((p) => `${p.color}:${p.type}:${key(p.pos)}`)
    .sort()
    .join('|')}`
}
export function createGame() {
  const pieces = initialPieces()
  return {
    pieces,
    turn: 'white',
    ply: 0,
    history: [],
    quiet: 0,
    repetitions: { [positionKey(pieces, 'white')]: 1 },
    status: 'playing',
    check: false,
  }
}
export function heatmap(pieces) {
  const board = new Map(pieces.map((p) => [key(p.pos), p])),
    heat = {}
  for (const p of pieces)
    for (const end of targets(p, board, true)) {
      const k = key(end)
      heat[k] ??= { white: 0, black: 0 }
      heat[k][p.color]++
    }
  return heat
}
export function advance(game, random = Math.random) {
  if (game.status !== 'playing') return game
  const moves = legalMoves(game.pieces, game.turn)
  const board = new Map(game.pieces.map((p) => [key(p.pos), p]))
  const king = game.pieces.find((p) => p.type === 'King' && p.color === game.turn)
  if (!moves.length) {
    const check = isAttacked(king.pos, game.turn, board)
    return { ...game, check, status: check ? 'checkmate' : 'stalemate' }
  }
  let chosen = moves[0],
    best = -Infinity
  // A transparent one-ply heuristic: material, safety, development, and variety.
  for (const move of moves) {
    const moving = board.get(key(move.start)),
      captured = board.get(key(move.end))
    board.delete(key(move.start))
    board.set(key(move.end), { ...moving, pos: move.end })
    const exposed = isAttacked(move.end, game.turn, board)
    board.delete(key(move.end))
    board.set(key(move.start), moving)
    if (captured) board.set(key(move.end), captured)
    const center = (pos) => pos.reduce((sum, v) => sum + Math.abs(v - 3.5), 0)
    const promotion = move.type === 'Pawn' && (move.end[1] === 0 || move.end[1] === 7)
    const recent = game.history
      .slice(-12)
      .filter((m) => m.id === move.id && key(m.end) === key(move.end)).length
    const score =
      (VALUES[move.captured] || 0) * 10 +
      (promotion ? 75 : 0) -
      (exposed ? (VALUES[move.type] || 0) * 8 : 0) +
      (center(move.start) - center(move.end)) * 0.35 -
      recent * 3 +
      random() * 1.2
    if (score > best) {
      best = score
      chosen = move
    }
  }
  const pieces = applyMove(game.pieces, chosen),
    turn = opposite(game.turn)
  const quiet = chosen.captured || chosen.type === 'Pawn' ? 0 : game.quiet + 1
  const signature = positionKey(pieces, turn)
  const repetitions = { ...game.repetitions, [signature]: (game.repetitions[signature] || 0) + 1 }
  const nextBoard = new Map(pieces.map((p) => [key(p.pos), p]))
  const nextKing = pieces.find((p) => p.type === 'King' && p.color === turn)
  const check = isAttacked(nextKing.pos, turn, nextBoard)
  const replies = legalMoves(pieces, turn)
  let status = 'playing'
  if (!replies.length) status = check ? 'checkmate' : 'stalemate'
  else if (repetitions[signature] >= 3) status = 'repetition'
  else if (quiet >= 100) status = 'fifty-move'
  else if (pieces.length === 2) status = 'insufficient'
  else if (game.ply + 1 >= 500) status = 'move-limit'
  return {
    pieces,
    turn,
    ply: game.ply + 1,
    history: [
      ...game.history,
      {
        ...chosen,
        promotion:
          chosen.type === 'Pawn' && pieces.find((p) => p.id === chosen.id).type === 'Queen',
      },
    ],
    quiet,
    repetitions,
    status,
    check,
  }
}
