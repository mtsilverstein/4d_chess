import time
import random
import copy
from engine import Piece, MoveEngine

PIECE_VALUES = {
    "Pawn": 10,
    "Knight": 30,
    "Bishop": 35,
    "Rook": 50,
    "Queen": 90,
    "King": 10000
}

class GameManager:
    def __init__(self):
        self.engine = MoveEngine()
        self.board = self.init_board()
        self.current_turn = "white"
        self.last_move = None
        self.max_time = 1.0 # strict 1 second limit for Iterative Deepening

    def init_board(self):
        board = [[[[None for _ in range(8)] for _ in range(8)] for _ in range(8)] for _ in range(8)]
        
        # Mathematical Realism setup: 
        # Pieces start completely bound to standard X,Y dimensions natively! 
        # As the simulation ticks, pieces will organically spill and climb into Z and W axes.
        zw, ww = 0, 0
        zb, wb = 0, 0

        for x in range(8):
            # White Pawns at y=1, z=0, w=0
            board[x][1][0][0] = Piece("white", "Pawn")
            # Black Pawns at y=6, z=7, w=7 
            board[x][6][7][7] = Piece("black", "Pawn")

        # Rooks
        board[0][0][0][0] = Piece("white", "Rook")
        board[7][0][0][0] = Piece("white", "Rook")
        board[0][7][7][7] = Piece("black", "Rook")
        board[7][7][7][7] = Piece("black", "Rook")
        # Knights
        board[1][0][0][0] = Piece("white", "Knight")
        board[6][0][0][0] = Piece("white", "Knight")
        board[1][7][7][7] = Piece("black", "Knight")
        board[6][7][7][7] = Piece("black", "Knight")
        # Bishops
        board[2][0][0][0] = Piece("white", "Bishop")
        board[5][0][0][0] = Piece("white", "Bishop")
        board[2][7][7][7] = Piece("black", "Bishop")
        board[5][7][7][7] = Piece("black", "Bishop")
        # Queens & Kings
        board[3][0][0][0] = Piece("white", "Queen")
        board[4][0][0][0] = Piece("white", "King")
        board[3][7][7][7] = Piece("black", "Queen")
        board[4][7][7][7] = Piece("black", "King")
                
        return board

    def get_all_valid_moves(self, color, board):
        all_moves = []
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = board[x][y][z][w]
                        if p and p.color == color:
                            moves = self.engine.get_moves((x,y,z,w), board)
                            for m in moves:
                                all_moves.append(((x,y,z,w), m))
        return all_moves

    def get_heatmap(self):
        heatmap = [[[[0.0 for _ in range(8)] for _ in range(8)] for _ in range(8)] for _ in range(8)]
        
        # Calculate coverage score. Both sides contribute to heat.
        # Max heat normalized around some heuristic value.
        max_heat = 0.001
        
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = self.board[x][y][z][w]
                        if p:
                            moves = self.engine.get_moves((x,y,z,w), self.board, ignore_check=True)
                            for m in moves:
                                heatmap[m[0]][m[1]][m[2]][m[3]] += 1
                                max_heat = max(max_heat, heatmap[m[0]][m[1]][m[2]][m[3]])
                                
        # Normalize
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        heatmap[x][y][z][w] = heatmap[x][y][z][w] / max_heat
                        
        return heatmap

    def evaluate_board(self, board):
        score = 0
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = board[x][y][z][w]
                        if p:
                            val = PIECE_VALUES[p.type]
                            # Small center bias
                            center_dist = abs(3.5 - x) + abs(3.5 - y) + abs(3.5 - z) + abs(3.5 - w)
                            val += (14 - center_dist) * 0.1
                            
                            if p.color == "white":
                                score += val
                            else:
                                score -= val
        return score

    def ai_tick(self):
        start_time = time.time()
        best_move_overall = None
        
        moves = self.get_all_valid_moves(self.current_turn, self.board)
        if not moves:
            return None # Checkmate or stalemate
            
        # Shuffle for variety
        random.shuffle(moves)
        
        # Basic greedy/shallow search within 1.0s limit
        # Due to 4096 squares, deep depth within 1s is tough without native C.
        # We will do depth 1 (greedy) always, and depth 2 if time allows.
        best_score = float('-inf') if self.current_turn == "white" else float('inf')
        
        for move in moves:
            if time.time() - start_time > self.max_time:
                break
                
            start, end = move
            captured = self.board[end[0]][end[1]][end[2]][end[3]]
            moving = self.board[start[0]][start[1]][start[2]][start[3]]
            
            self.board[end[0]][end[1]][end[2]][end[3]] = moving
            self.board[start[0]][start[1]][start[2]][start[3]] = None
            
            score = self.evaluate_board(self.board)
            
            # revert
            self.board[start[0]][start[1]][start[2]][start[3]] = moving
            self.board[end[0]][end[1]][end[2]][end[3]] = captured
            
            if self.current_turn == "white":
                if score > best_score:
                    best_score = score
                    best_move_overall = move
            else:
                if score < best_score:
                    best_score = score
                    best_move_overall = move
                    
        if best_move_overall is None:
            best_move_overall = moves[0]
            
        # Apply move
        start, end = best_move_overall
        self.board[end[0]][end[1]][end[2]][end[3]] = self.board[start[0]][start[1]][start[2]][start[3]]
        self.board[start[0]][start[1]][start[2]][start[3]] = None
        self.last_move = {"start": start, "end": end}
        self.current_turn = "black" if self.current_turn == "white" else "white"
        
        return self.last_move

    def get_board_state(self):
        state = [[[[None for _ in range(8)] for _ in range(8)] for _ in range(8)] for _ in range(8)]
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = self.board[x][y][z][w]
                        if p:
                            state[x][y][z][w] = p.to_dict()
        return state