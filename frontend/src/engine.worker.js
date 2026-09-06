import { advance, createGame, heatmap } from './engine'

let game = createGame()
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'reset') game = createGame()
    if (data.type === 'step') game = advance(game)
    self.postMessage({ game, heat: heatmap(game.pieces), generation: data.generation })
  } catch (error) {
    self.postMessage({ error: error.message, generation: data.generation })
  }
}
