import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advance,
  applyMove,
  createGame,
  heatmap,
  initialPieces,
  isAttacked,
  key,
  legalMoves,
  positionKey,
  targets,
} from '../src/engine.js'
import { corners, edges, nodes, project4D } from '../src/projection.js'

const piece = (type, pos, color = 'white', id = `${color}-${type}`) => ({ type, pos, color, id })
const board = (pieces) => new Map(pieces.map((p) => [key(p.pos), p]))
const kings = [piece('King', [0, 0, 0, 0]), piece('King', [7, 7, 7, 7], 'black')]
const has = (moves, pos) => moves.some((m) => key(m.end || m) === key(pos))

test('opening contains 32 unique pieces, two kings, opposite starting planes', () => {
  const pieces = initialPieces()
  assert.equal(pieces.length, 32)
  assert.equal(new Set(pieces.map((p) => p.id)).size, 32)
  assert.equal(new Set(pieces.map((p) => key(p.pos))).size, 32)
  assert.equal(pieces.filter((p) => p.type === 'King').length, 2)
  assert.ok(pieces.every((p) => p.pos[2] === (p.color === 'white' ? 0 : 7)))
  assert.ok(legalMoves(pieces, 'white').length > 0)
})

test('interior pieces span all four axes with unique movement vectors', () => {
  // Six axis pairs, each with diagonals of lengths 4 + 3 + 3 + 3.
  for (const [type, count] of [
    ['Rook', 28],
    ['Bishop', 78],
    ['Knight', 48],
    ['King', 80],
  ]) {
    const p = piece(type, [3, 3, 3, 3]),
      moves = targets(p, board([p]))
    assert.equal(moves.length, count, type)
    assert.equal(new Set(moves.map(key)).size, count)
  }
  const queen = piece('Queen', [3, 3, 3, 3])
  assert.ok(has(targets(queen, board([queen])), [6, 6, 6, 6]))
  const bishop = piece('Bishop', [3, 3, 3, 3])
  assert.ok(!has(targets(bishop, board([bishop])), [4, 4, 4, 3]))
})

test('sliders stop at friendly blockers and after captures; knights jump', () => {
  const rook = piece('Rook', [3, 3, 3, 3])
  const pieces = [rook, piece('Pawn', [3, 3, 4, 3]), piece('Pawn', [3, 3, 3, 5], 'black')]
  const moves = targets(rook, board(pieces))
  assert.ok(!has(moves, [3, 3, 4, 3]))
  assert.ok(!has(moves, [3, 3, 5, 3]))
  assert.ok(has(moves, [3, 3, 3, 5]))
  assert.ok(!has(moves, [3, 3, 3, 6]))
  const knight = piece('Knight', [3, 3, 3, 3])
  assert.ok(has(targets(knight, board([...pieces.slice(1), knight])), [3, 3, 5, 4]))
})

test('pawns push on Y, double only when clear, and attack along X/Z/W', () => {
  const pawn = piece('Pawn', [3, 1, 3, 3])
  assert.deepEqual(targets(pawn, board([pawn])), [
    [3, 2, 3, 3],
    [3, 3, 3, 3],
  ])
  assert.equal(targets(pawn, board([pawn]), true).length, 6)
  assert.ok(!has(targets(pawn, board([pawn]), true), [3, 2, 3, 3]))
  assert.equal(targets(pawn, board([pawn, piece('Rook', [3, 2, 3, 3])])).length, 0)
  for (const end of [
    [4, 2, 3, 3],
    [3, 2, 4, 3],
    [3, 2, 3, 4],
  ]) {
    assert.ok(has(targets(pawn, board([pawn, piece('Rook', end, 'black')])), end))
  }
  const black = piece('Pawn', [3, 6, 3, 3], 'black')
  assert.deepEqual(targets(black, board([black])), [
    [3, 5, 3, 3],
    [3, 4, 3, 3],
  ])
})

test('legal filtering preserves input and prevents moving a pinned rook off the king ray', () => {
  const pieces = [...kings, piece('Rook', [1, 0, 0, 0]), piece('Rook', [5, 0, 0, 0], 'black')]
  const before = JSON.stringify(pieces)
  const moves = legalMoves(pieces, 'white').filter((m) => m.id === 'white-Rook')
  assert.ok(moves.length > 0)
  assert.ok(moves.every((m) => m.end.slice(1).every((n) => n === 0)))
  assert.equal(JSON.stringify(pieces), before)
})

test('king cannot enter pawn attacks, enemy king adjacency, or capture a king', () => {
  const pieces = [
    piece('King', [0, 0, 0, 0]),
    piece('King', [2, 2, 2, 2], 'black'),
    piece('Pawn', [1, 2, 0, 0], 'black'),
  ]
  const moves = legalMoves(pieces, 'white')
  assert.ok(!has(moves, [0, 1, 0, 0]))
  assert.ok(!has(moves, [1, 1, 1, 1]))
  const invalidPosition = [...kings, piece('Queen', [6, 6, 6, 6])]
  assert.ok(!has(legalMoves(invalidPosition, 'white'), [7, 7, 7, 7]))
})

test('promotion changes type, keeps identity, captures, and leaves source immutable', () => {
  const pieces = [...kings, piece('Pawn', [3, 6, 3, 3]), piece('Rook', [4, 7, 3, 3], 'black')]
  const move = legalMoves(pieces, 'white').find((m) => key(m.end) === '4,7,3,3')
  const next = applyMove(pieces, move)
  assert.equal(next.find((p) => p.id === 'white-Pawn').type, 'Queen')
  assert.equal(next.length, pieces.length - 1)
  assert.equal(pieces.find((p) => p.id === 'white-Pawn').type, 'Pawn')
})

test('checkmate and stalemate are terminal without capturing kings', () => {
  const pieces = [
    piece('King', [0, 0, 0, 0]),
    piece('King', [2, 2, 2, 2], 'black'),
    piece('Queen', [1, 1, 1, 1], 'black'),
  ]
  const mate = advance({ ...createGame(), pieces })
  assert.equal(mate.status, 'checkmate')
  assert.equal(mate.check, true)
  assert.equal(mate.pieces.length, 3)
  assert.equal(advance(mate), mate)
  // Cover every neighbor of the corner king with a knight that does not check it.
  const locked = [...kings]
  const neighbors = targets(kings[0], board(kings))
  for (const [i, end] of neighbors.entries()) {
    const attacker = piece('Knight', [end[0] + 2, end[1] + 1, end[2], end[3]], 'black', `n${i}`)
    if (!isAttacked(kings[0].pos, 'white', board([attacker]))) locked.push(attacker)
    else locked.push(piece('Knight', [end[0] + 1, end[1] + 2, end[2], end[3]], 'black', `n${i}`))
  }
  assert.equal(isAttacked(kings[0].pos, 'white', board(locked)), false)
  assert.equal(advance({ ...createGame(), pieces: locked }).status, 'stalemate')
})

test('draw counters, position identity, and attack pressure are meaningful', () => {
  const game = createGame()
  const next = advance(game, () => 0.5)
  const signature = positionKey(next.pieces, next.turn)
  assert.equal(
    advance({ ...game, repetitions: { [signature]: 2 } }, () => 0.5).status,
    'repetition',
  )
  assert.equal(
    positionKey([...game.pieces].reverse(), game.turn),
    positionKey(game.pieces, game.turn),
  )
  assert.notEqual(positionKey(game.pieces, 'black'), positionKey(game.pieces, 'white'))
  assert.equal(advance({ ...game, pieces: kings }).status, 'insufficient')
  const quietPieces = [...kings, piece('Knight', [3, 3, 3, 3])]
  assert.equal(advance({ ...game, pieces: quietPieces, quiet: 99 }).status, 'fifty-move')
  assert.equal(advance({ ...game, ply: 499 }).status, 'move-limit')
  const pawn = piece('Pawn', [3, 1, 3, 3]),
    h = heatmap([pawn])
  assert.equal(h['3,2,3,3'], undefined)
  assert.equal(h['3,2,4,3'].white, 1)
})

test('direct attack detector agrees with expanded attack maps across a seeded game', () => {
  let state = 17
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  let game = createGame()
  for (let i = 0; i < 40 && game.status === 'playing'; i++) {
    const before = JSON.stringify(game)
    const next = advance(game, random)
    assert.equal(JSON.stringify(game), before)
    assert.equal(next.ply, game.ply + 1)
    assert.equal(next.pieces.filter((p) => p.type === 'King').length, 2)
    assert.equal(new Set(next.pieces.map((p) => key(p.pos))).size, next.pieces.length)
    const b = board(next.pieces)
    const movedKing = next.pieces.find((p) => p.color === game.turn && p.type === 'King')
    assert.equal(isAttacked(movedKing.pos, game.turn, b), false)
    for (let n = 0; n < 15; n++) {
      const pos = Array.from({ length: 4 }, () => Math.floor(random() * 8))
      for (const color of ['white', 'black']) {
        const expected = next.pieces.some((p) => p.color !== color && has(targets(p, b, true), pos))
        assert.equal(isAttacked(pos, color, b), expected, `${color} ${pos}`)
      }
    }
    game = next
  }
})

test('projection remains finite over rotations and all 4096 coordinates', () => {
  assert.equal(corners.length, 16)
  assert.equal(edges.length, 32)
  assert.equal(new Set(nodes.map(key)).size, 4096)
  for (const angle of [0, 0.5, 1, 2, 4, 10, 100])
    for (const pos of nodes) {
      assert.ok(project4D(pos, angle).every(Number.isFinite))
    }
})
