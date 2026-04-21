from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from manager import GameManager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

game_manager = None

@app.on_event("startup")
async def on_startup():
    global game_manager
    game_manager = GameManager()

class TickResponse(BaseModel):
    board: list
    heatmap: list
    last_move: dict | None
    turn: str
    checkmate: bool

@app.get("/tick")
async def tick():
    global game_manager
    
    # Auto-loop Screensaver: check if game is over (Checkmate or Stalemate)
    moves = game_manager.get_all_valid_moves(game_manager.current_turn, game_manager.board)
    if not moves or game_manager.engine.is_checkmate(game_manager.current_turn, game_manager.board):
        # Start a brand new game natively (the frontend will pick this up automatically gracefully)
        game_manager = GameManager()
        
    last_move = game_manager.ai_tick()
    state = game_manager.get_board_state()
    heatmap = game_manager.get_heatmap()
    
    return {
        "board": state,
        "heatmap": heatmap,
        "last_move": game_manager.last_move,
        "turn": game_manager.current_turn,
        "checkmate": False
    }

@app.post("/reset")
async def reset():
    global game_manager
    game_manager = GameManager()
    return {"message": "Reset successful"}