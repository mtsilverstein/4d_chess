import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

const API_URL = "http://127.0.0.1:8000";
const SCHLEGEL_FOCAL = 34;    // defines how deep the 4th dimension zooms inward 

// SCHLEGEL 4D -> 3D PROJECTION
// Now featuring dual-plane Isoclinic Rotation for mathematical realism
const project4DTo3D = (pos, t, returnScale = false) => {
  let x = pos[0] - 3.5;
  let y = pos[1] - 3.5;
  let z = pos[2] - 3.5;
  let w = pos[3] - 3.5;

  const SC = 2.4; 
  x *= SC; y *= SC; z *= SC; w *= SC;

  // 1. Rotation in XW plane
  const c1 = Math.cos(t), s1 = Math.sin(t);
  let xw = x * c1 - w * s1;
  let w1 = x * s1 + w * c1;

  // 2. Rotation in ZW plane (causes the iconic folding inside-out effect)
  const c2 = Math.cos(t * 0.618), s2 = Math.sin(t * 0.618); // golden ratio speed differential
  let zw = z * c2 - w1 * s2;
  let w2 = z * s2 + w1 * c2;

  // 3. Perspective Projection Factor
  const f = SCHLEGEL_FOCAL / (SCHLEGEL_FOCAL - w2); 

  // LAY THE BOARD FLAT: Map mathematical Y (forward/back) to visual Z (depth)
  // Map mathematical Z to visual Y (height)
  // This ensures the 2D chess slice sits properly on a horizontal floor rather than a vertical wall
  let visX = xw * f;
  let visY = zw * f; 
  let visZ = -(y * f); // negative so higher Y goes further into the screen like a standard chess board

  if (returnScale) return [visX, visY, visZ, f];
  return [visX, visY, visZ];
};

const CHECAOUnicode = {
  white: { Pawn: '♙', Knight: '♘', Bishop: '♗', Rook: '♖', Queen: '♕', King: '♔' },
  black: { Pawn: '♟', Knight: '♞', Bishop: '♝', Rook: '♜', Queen: '♛', King: '♚' }
};

// Sub-grid quantum dots: Shows the entire 4,096 coordinate fabric in the hypercube
const HypergridNodes = ({ rotationSpeed }) => {
    const geomRef = useRef();
    
    // Exactly 8*8*8*8 = 4096 individual spatial nodes
    const pts = useMemo(() => {
      const arr = [];
      for(let w=0; w<8; w++)
      for(let z=0; z<8; z++)
      for(let y=0; y<8; y++)
      for(let x=0; x<8; x++)
         arr.push([x,y,z,w]);
      return arr;
    }, []);

    useFrame((state) => {
       if (!geomRef.current) return;
       const t = state.clock.elapsedTime * rotationSpeed;
       const positions = geomRef.current.attributes.position.array;
       
       for(let i=0; i<pts.length; i++) {
          const [px, py, pz] = project4DTo3D(pts[i], t);
          positions[i*3] = px;
          positions[i*3+1] = py;
          positions[i*3+2] = pz;
       }
       geomRef.current.attributes.position.needsUpdate = true;
    });

    return (
      <points>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position" count={4096} array={new Float32Array(4096 * 3)} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial 
          color="#0aa" 
          size={0.06} 
          transparent 
          opacity={0.15} 
          blending={THREE.AdditiveBlending} 
          depthWrite={false} 
        />
      </points>
    );
};

// Animated 3D Piece that traverses 4D Space
const AnimatedPiece3D = ({ color, type, pos4D, rotationSpeed }) => {
  const ref = useRef();
  const ringRef = useRef();
  const isWhite = color === 'white';
  const hexColor = isWhite ? "#00ffff" : "#ff00ff";
  const symbol = CHECAOUnicode[color][type];

  // Randomize initial rotation speed slightly so rings spin organically
  const spinSpeed = useMemo(() => (Math.random() * 0.5 + 0.5) * (isWhite ? 1 : -1), [isWhite]);

  useFrame((state) => {
    const dt = state.clock.elapsedTime;
    const t = dt * rotationSpeed;
    const [x, y, z, scale] = project4DTo3D(pos4D, t, true);
    
    if (ref.current) {
        ref.current.position.set(x, y, z);
        const finalScale = Math.max(0.1, scale * 1.5);
        ref.current.scale.set(finalScale, finalScale, finalScale);
    }
    
    // Spin the ethereal holographic ring locally
    if (ringRef.current) {
      ringRef.current.rotation.z = dt * spinSpeed;
    }
  });

  return (
    <group ref={ref}>
      {/* Sci-fi Glass Base */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.05, 16]} />
        <meshPhysicalMaterial 
          color={hexColor} 
          emissive={hexColor} 
          emissiveIntensity={0.4} 
          transparent={true} 
          opacity={0.7} 
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Upgraded Glass Crystal Core */}
      <mesh position={[0, -0.15, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshPhysicalMaterial 
          color={hexColor} 
          emissive={hexColor} 
          emissiveIntensity={0.5} 
          wireframe={true} 
          transparent={true} 
          opacity={0.3} 
        />
      </mesh>
      
      {/* Ethereal Holographic Spinning Ring */}
      <mesh ref={ringRef} position={[0, -0.35, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[0.5, 0.015, 16, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={THREE.AdditiveBlending}/>
      </mesh>
      
      {/* Hologram Symbol */}
      <Text 
        position={[0, 0.4, 0]} 
        fontSize={1.3} 
        color="#ffffff" 
        outlineWidth={0.03} 
        outlineColor={hexColor}
        anchorX="center"
        anchorY="middle"
      >
        {symbol}
      </Text>
    </group>
  );
};

// Defines the massive 32 bounding edges of the 4D matrix physically linking dimensions
const HypercubeWireframe = ({ rotationSpeed, opacity }) => {
  const geomRef = useRef();

  const edges = useMemo(() => {
     const pts = [];
     for(let i = 0; i < 16; i++) {
         let x1 = (i & 1) ? 7 : 0, y1 = (i & 2) ? 7 : 0, z1 = (i & 4) ? 7 : 0, w1 = (i & 8) ? 7 : 0;
         for(let j = 0; j < 4; j++) {
             if ((i & (1 << j)) === 0) {
                 let x2 = x1, y2 = y1, z2 = z1, w2 = w1;
                 if (j === 0) x2 = 7;
                 if (j === 1) y2 = 7;
                 if (j === 2) z2 = 7;
                 if (j === 3) w2 = 7;
                 pts.push([x1, y1, z1, w1]);
                 pts.push([x2, y2, z2, w2]);
             }
         }
     }
     return pts;
  }, []);

  useFrame((state) => {
     if (!geomRef.current) return;
     const t = state.clock.elapsedTime * rotationSpeed;
     const positions = geomRef.current.attributes.position.array;
     for(let i = 0; i < edges.length; i++) {
         const [x, y, z] = project4DTo3D(edges[i], t);
         positions[i*3] = x;
         positions[i*3+1] = y;
         positions[i*3+2] = z;
     }
     geomRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
         <bufferAttribute attach="attributes-position" count={edges.length} array={new Float32Array(edges.length * 3)} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#4455aa" transparent opacity={opacity} />
    </lineSegments>
  );
};

const AnimatedLaserTrail = ({ lastMove, rotationSpeed }) => {
  const geomRef = useRef();

  useFrame((state) => {
     if (!lastMove || !geomRef.current) return;
     const t = state.clock.elapsedTime * rotationSpeed;
     const p1 = project4DTo3D(lastMove.start, t);
     const p2 = project4DTo3D(lastMove.end, t);
     
     const positions = geomRef.current.attributes.position.array;
     positions[0] = p1[0]; positions[1] = p1[1]; positions[2] = p1[2];
     positions[3] = p2[0]; positions[4] = p2[1]; positions[5] = p2[2];
     geomRef.current.attributes.position.needsUpdate = true;
  });

  if (!lastMove) return null;

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
         <bufferAttribute attach="attributes-position" count={2} array={new Float32Array(6)} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffff00" transparent opacity={0.9} />
    </lineSegments>
  );
};

function App() {
  const [boardData, setBoardData] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [error, setError] = useState(false);
  const [ticks, setTicks] = useState(0);

  // User Settings State
  const [settings, setSettings] = useState({
    rotationSpeed: 0.2,
    bloomIntensity: 1.5,
    cameraDrift: 0.5,
    wireframeOpacity: 0.1,
    showGridNodes: true
  });

  // Automatically fetch from backend loop
  useEffect(() => {
    fetch(`${API_URL}/reset`, { method: "POST" })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/tick`);
        if (!res.ok) throw new Error("API Tick Failed");
        const data = await res.json();
        setBoardData(data.board);
        setLastMove(data.last_move);
        setTicks(prev => prev + 1);
        setError(false);
      } catch (err) {
        setError(true);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
        <div className="absolute inset-0 flex items-center justify-center text-[#ff3333] text-2xl font-mono shadow-red bg-[#020202]">
          DATA FEED INTERRUPTED...
        </div>
    );
  }

  if (!boardData.length) {
    return (
        <div className="absolute inset-0 flex items-center justify-center text-cyan-500 text-2xl font-mono opacity-60 animate-pulse bg-[#020202]">
          INITIALIZING DIMENSIONAL MATRIX...
        </div>
    );
  }

  const piecesComponents = [];
  for (let w = 0; w < 8; w++) {
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const piece = boardData[x][y][z][w];
          if (piece) {
            piecesComponents.push(
              <AnimatedPiece3D 
                key={`p-${x}-${y}-${z}-${w}-${piece.color}-${piece.type}`}
                color={piece.color} 
                type={piece.type}
                pos4D={[x, y, z, w]} 
                rotationSpeed={settings.rotationSpeed}
              />
            );
          }
        }
      }
    }
  }

  return (
    <div className="w-screen h-screen bg-[#020202] overflow-hidden relative selection:bg-cyan-500/30">
      
      {/* Sci-Fi HUD Overlay */}
      <div className="absolute top-6 left-6 z-10 text-cyan-400 font-mono pointer-events-none drop-shadow-[0_0_10px_rgba(0,255,255,0.7)] flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-[0.25em] text-[#fff]">HYPER-ENGINE V4</h1>
        <div className="w-64 h-[1px] bg-gradient-to-r from-cyan-400 to-transparent my-1"></div>
        <p className="text-xs tracking-widest text-[#0ff]/80">MATRIX SCHLEGEL PROJECTION [ONLINE]</p>
        <p className="text-xs tracking-wide text-[#0ff]/60">AXES LOCK: [X,Y] --- SPILLOVER DETECTED: [Z,W]</p>
        <p className="text-xs tracking-wide text-[#0ff]/60">CYCLES ALIVE: {ticks}</p>
        <p className="text-xs tracking-widest bg-cyan-900/30 w-max px-2 py-1 mt-2 border border-cyan-400/20">
          {lastMove ? "SIMULATING ORGANIC VECTOR" : "AWAITING ENGINE RESPONSE"}
        </p>
      </div>

      {/* Interactive Control Panel */}
      <div className="absolute top-6 right-6 z-10 w-72 bg-black/60 backdrop-blur-md border border-cyan-900/50 p-4 font-mono text-cyan-400 drop-shadow-lg flex flex-col gap-4">
        <h2 className="text-sm font-bold tracking-widest text-[#fff] border-b border-cyan-900 pb-2 mb-2">ENGINE OVERRIDES</h2>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs flex justify-between">4D ISOCLINIC ROTATION <span>{settings.rotationSpeed.toFixed(2)}x</span></label>
          <input type="range" min="0" max="1" step="0.05" value={settings.rotationSpeed} 
            onChange={(e) => setSettings({...settings, rotationSpeed: parseFloat(e.target.value)})}
            className="accent-cyan-500 bg-cyan-950/30 h-1 appearance-none cursor-pointer" />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs flex justify-between">CAMERA ORBIT DRIFT <span>{settings.cameraDrift.toFixed(1)}x</span></label>
          <input type="range" min="0" max="2" step="0.1" value={settings.cameraDrift} 
            onChange={(e) => setSettings({...settings, cameraDrift: parseFloat(e.target.value)})}
            className="accent-cyan-500 bg-cyan-950/30 h-1 appearance-none cursor-pointer" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs flex justify-between">POST-PROC BLOOM <span>{settings.bloomIntensity.toFixed(1)}</label>
          <input type="range" min="0" max="4" step="0.1" value={settings.bloomIntensity} 
            onChange={(e) => setSettings({...settings, bloomIntensity: parseFloat(e.target.value)})}
            className="accent-cyan-500 bg-cyan-950/30 h-1 appearance-none cursor-pointer" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs flex justify-between">HYPERCUBE WIREFRAME OPACITY <span>{settings.wireframeOpacity.toFixed(2)}</span></label>
          <input type="range" min="0" max="0.5" step="0.05" value={settings.wireframeOpacity} 
            onChange={(e) => setSettings({...settings, wireframeOpacity: parseFloat(e.target.value)})}
            className="accent-cyan-500 bg-cyan-950/30 h-1 appearance-none cursor-pointer" />
        </div>
        
        <div className="flex items-center gap-2 mt-2 cursor-pointer" onClick={() => setSettings({...settings, showGridNodes: !settings.showGridNodes})}>
          <div className={`w-3 h-3 border border-cyan-400 ${settings.showGridNodes ? 'bg-cyan-500' : 'bg-transparent'}`}></div>
          <label className="text-xs pointer-events-none">RENDER QUANTUM GRID NODES</label>
        </div>
      </div>

      <Canvas camera={{ position: [0, 8, 38], fov: 50 }}>
        <color attach="background" args={['#020203']} />
        
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 20, 10]} intensity={2.0} color="#ffffff" />
        <pointLight position={[-10, 5, -10]} intensity={1.0} color="#ff00ff" />

        {/* Core Mathematical Bounding Physics */}
        <HypercubeWireframe rotationSpeed={settings.rotationSpeed} opacity={settings.wireframeOpacity} />
        
        {/* Sub-grid 4,096 dimension field point dots */}
        {settings.showGridNodes && <HypergridNodes rotationSpeed={settings.rotationSpeed} />}
        
        {/* Pieces themselves */}
        {piecesComponents}

        {/* Action laser pulse line */}
        <AnimatedLaserTrail lastMove={lastMove} rotationSpeed={settings.rotationSpeed} />

        {/* Hollywood sci-fi visual FX */}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={400} intensity={settings.bloomIntensity} />
          <ChromaticAberration offset={[0.002, 0.002]} opacity={0.3} />
          <Noise opacity={0.03} />
        </EffectComposer>

        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={200}
          autoRotate={settings.cameraDrift > 0}
          autoRotateSpeed={settings.cameraDrift} /* Let the 4D physics do the inside-out rotating, while the camera drifts globally */
        />
      </Canvas>

      {/* Frame Vignette for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 150px #000' }}></div>
    </div>
  );
}

export default App;