import itertools
import copy

class Piece:
    def __init__(self, color, p_type):
        self.color = color
        self.type = p_type
        # Simple string representation for easy JSON serialization
        self.symbol = p_type[0].upper() if p_type != "Knight" else "N"
        
    def to_dict(self):
        return {"color": self.color, "type": self.type, "symbol": self.symbol}

class MoveEngine:
    def __init__(self):
        pass

    def is_valid_pos(self, x, y, z, w):
        return all(0 <= c < 8 for c in (x, y, z, w))

    def get_moves(self, pos, board, ignore_check=False):
        p = board[pos[0]][pos[1]][pos[2]][pos[3]]
        if not p: return []
        
        moves = []
        if p.type == "Rook":
            dirs = [v for v in itertools.product([-1,0,1], repeat=4) if list(map(abs, v)).count(1) == 1]
            moves = self.get_sliding_moves(pos, dirs, board, p.color)
        elif p.type == "Bishop":
            dirs = [v for v in itertools.product([-1,0,1], repeat=4) if list(map(abs, v)).count(1) == 2]
            moves = self.get_sliding_moves(pos, dirs, board, p.color)
        elif p.type == "Knight":
            # A knight moves 2 squares in one direction and 1 in another.
            dirs = []
            for axis1 in range(4):
                for axis2 in range(4):
                    if axis1 != axis2:
                        for sign1 in [1, -1]:
                            for sign2 in [1, -1]:
                                d = [0, 0, 0, 0]
                                d[axis1] = 2 * sign1
                                d[axis2] = 1 * sign2
                                dirs.append(tuple(d))
            dirs = list(set(dirs)) # remove duplicates
            moves = self.get_jump_moves(pos, dirs, board, p.color)
        elif p.type == "Queen":
            dirs = [v for v in itertools.product([-1,0,1], repeat=4) if v != (0,0,0,0)]
            moves = self.get_sliding_moves(pos, dirs, board, p.color)
        elif p.type == "King":
            dirs = [v for v in itertools.product([-1,0,1], repeat=4) if v != (0,0,0,0)]
            moves = self.get_jump_moves(pos, dirs, board, p.color)
        elif p.type == "Pawn":
            # White moves positive Y (+1), Black moves negative Y (-1).
            direction = 1 if p.color == "white" else -1
            
            # Forward move
            nx, ny, nz, nw = pos[0], pos[1] + direction, pos[2], pos[3]
            if self.is_valid_pos(nx, ny, nz, nw) and board[nx][ny][nz][nw] is None:
                moves.append((nx, ny, nz, nw))
                # Initial 2-step jump if pawn hasn't moved.
                # Let's say starting Y is 1 for White, 6 for Black.
                if (p.color == "white" and pos[1] == 1) or (p.color == "black" and pos[1] == 6):
                    nny = pos[1] + 2 * direction
                    if board[nx][nny][nz][nw] is None:
                        moves.append((nx, nny, nz, nw))
            
            # Attacks: change Y by `direction`, change one other dimension by +/- 1
            for axis in [0, 2, 3]: # x, z, w
                for sign in [-1, 1]:
                    np_pos = list(pos)
                    np_pos[1] += direction
                    np_pos[axis] += sign
                    vx, vy, vz, vw = np_pos
                    if self.is_valid_pos(vx, vy, vz, vw):
                        target = board[vx][vy][vz][vw]
                        if target is not None and target.color != p.color:
                            moves.append((vx, vy, vz, vw))

        if not ignore_check:
            # Filter moves out that would leave King in check
            moves = self.filter_safe_moves(pos, moves, board, p.color)
        
        return moves

    def get_sliding_moves(self, pos, dirs, board, color):
        moves = []
        for d in dirs:
            for step in range(1, 8):
                nx = pos[0] + d[0] * step
                ny = pos[1] + d[1] * step
                nz = pos[2] + d[2] * step
                nw = pos[3] + d[3] * step
                
                if not self.is_valid_pos(nx, ny, nz, nw):
                    break
                    
                target = board[nx][ny][nz][nw]
                if target is None:
                    moves.append((nx, ny, nz, nw))
                else:
                    if target.color != color:
                        moves.append((nx, ny, nz, nw))
                    break
        return moves

    def get_jump_moves(self, pos, dirs, board, color):
        moves = []
        for d in dirs:
            nx = pos[0] + d[0]
            ny = pos[1] + d[1]
            nz = pos[2] + d[2]
            nw = pos[3] + d[3]
            
            if self.is_valid_pos(nx, ny, nz, nw):
                target = board[nx][ny][nz][nw]
                if target is None or target.color != color:
                    moves.append((nx, ny, nz, nw))
        return list(set(moves))

    def filter_safe_moves(self, start, moves, board, color):
        safe_moves = []
        for end in moves:
            # simulate move efficiently without deepcopy
            tx, ty, tz, tw = end
            sx, sy, sz, sw = start
            captured_piece = board[tx][ty][tz][tw]
            moving_piece = board[sx][sy][sz][sw]
            
            board[tx][ty][tz][tw] = moving_piece
            board[sx][sy][sz][sw] = None
            
            if not self.is_in_check(color, board):
                safe_moves.append(end)
                
            # revert move
            board[sx][sy][sz][sw] = moving_piece
            board[tx][ty][tz][tw] = captured_piece
            
        return safe_moves

    def find_king(self, color, board):
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = board[x][y][z][w]
                        if p and p.type == "King" and p.color == color:
                            return (x, y, z, w)
        return None

    def is_in_check(self, color, board):
        king_pos = self.find_king(color, board)
        if not king_pos: return False # Should never happen but edge case protected
        
        # Check if any enemy piece can hit the king
        enemy_color = "black" if color == "white" else "white"
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = board[x][y][z][w]
                        if p and p.color == enemy_color:
                            enemy_moves = self.get_moves((x,y,z,w), board, ignore_check=True)
                            if king_pos in enemy_moves:
                                return True
        return False

    def is_checkmate(self, color, board):
        if not self.is_in_check(color, board):
            return False
        
        # Check if ANY valid move exists for player
        for x in range(8):
            for y in range(8):
                for z in range(8):
                    for w in range(8):
                        p = board[x][y][z][w]
                        if p and p.color == color:
                            if len(self.get_moves((x,y,z,w), board)) > 0:
                                return False
        return True