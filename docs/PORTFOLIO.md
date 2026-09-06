# Portfolio presentation

## Project card

**Tesseract — Four-dimensional chess**

An interactive chess simulation that extends familiar piece movement into four
dimensions. Two autonomous players navigate 4,096 coordinates while a rotating
projection and live plane inspector make the geometry explorable.

**Stack:** React, JavaScript, Canvas 2D, Web Workers, Vite, Node test runner, Playwright.

Use `tesseract-desktop.png` as the project image. Add the deployed URL after
publication; do not use a localhost address as the portfolio link.

## Case study

### The problem

Four-dimensional geometry is difficult to understand from equations alone. The
original local-server prototype visualized the idea but did not offer a portable,
explainable experience for someone visiting a portfolio.

### The solution

Tesseract combines an animated projection with a conventional XY chessboard
inspector. Visitors can follow an autonomous game, pause and step through moves,
select pieces, and switch Z/W planes to connect the abstract view to exact
coordinates. A restrained ivory, copper, and sage palette distinguishes the two
sides and the coordinate structure.

### Engineering decisions

- Represent occupied cells sparsely and check attacks directly, instead of
  expanding every enemy move for every candidate move.
- Isolate CPU computation in a worker. Let React own controls while Canvas owns
  animation; simulation work does not block camera interaction.
- Use generation-tagged messages to make reset safe during an in-flight move.
- Define a consistent variant and document its limits, including the absence of
  castling/en passant and the intentionally shallow CPU heuristic.
- Make the production app a static bundle with no backend dependency or external
  fonts. This simplifies hosting and gives every visitor independent game state.
- Pair mathematical regression tests with browser tests for the real user flow.

### Scope and limitations

This is an autonomous strategy and visualization experiment. It is not a strong
chess AI, a multiplayer service, or a standardized rules implementation. The
projection compresses space and can overlap pieces; the plane inspector provides
the precise view. Games reset on reload.

## 60-second walkthrough

1. Open **The experiment** and introduce the four-coordinate board.
2. Select a starting king in the plane inspector to reveal its coordinates.
3. Press **Play simulation**. Point out pieces crossing between Z/W planes.
4. Pause, advance one move, and use the move log to explain the coordinate change.
5. Disable **Follow move** and change Z/W to inspect a different plane.
6. Enable **Attack pressure**, orbit the projection, then enter immersive view.

## Images

- [Desktop](tesseract-desktop.png)
- [Mobile](tesseract-mobile.png)

Screenshots show the actual application, not a design mockup.
