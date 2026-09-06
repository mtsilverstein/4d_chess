# Historical Python prototype

These files preserve the original FastAPI experiment. They are not used by the
portfolio app and are not the supported deployment path. No Python server is
required to run Tesseract.

The maintained engine is `frontend/src/engine.js`, with regression tests in
`frontend/tests/engine.test.js`. It replaces the prototype's shared server state,
expensive dense-board move generation, and incomplete terminal-state reporting.

The Python implementation is retained for project history, not as an equivalent
or validated API. See the root README for setup, rules, and architecture.
