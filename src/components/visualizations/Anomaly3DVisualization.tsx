import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

interface Anomaly3DVisualizationProps {
  detections: { index: number; is_anomaly: boolean; anomaly_score: number }[];
  totalCount: number;
  anomalyCount: number;
}

interface PointProps {
  position: [number, number, number];
  isAnomaly: boolean;
  score: number;
  index: number;
  radius: number;
}

function ScatterPoint({ position, isAnomaly, score, index, radius }: PointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = isAnomaly ? '#ef4444' : '#22c55e';
  const hoverColor = isAnomaly ? '#ff6b6b' : '#4ade80';

  useFrame((_, delta) => {
    if (meshRef.current && isAnomaly) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.x += delta * 0.3;
      const s = hovered ? 1.3 : 1.0;
      meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, s, 0.1));
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      <icosahedronGeometry args={[radius, isAnomaly ? 1 : 0]} />
      <meshStandardMaterial
        color={hovered ? hoverColor : color}
        emissive={color}
        emissiveIntensity={hovered ? 0.7 : isAnomaly ? 0.4 : 0.15}
        roughness={0.4}
        metalness={0.2}
        transparent
        opacity={isAnomaly ? 0.95 : 0.6}
      />
      {hovered && (
        <Html position={[0, radius + 0.4, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="bg-carbon-900 border border-copper/40 text-copper-light px-2.5 py-1.5 rounded text-[10px] font-mono whitespace-nowrap shadow-lg">
            <div className="font-bold text-warm-pale mb-0.5">Row #{index + 1}</div>
            <div>Score: <span className={isAnomaly ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{score.toFixed(4)}</span></div>
            <div className={isAnomaly ? 'text-rose-400' : 'text-emerald-400'}>{isAnomaly ? '⚠ ANOMALY' : '✓ Normal'}</div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

function ThresholdPlane({ width, depth, y }: { width: number; depth: number; y: number }) {
  return (
    <mesh position={[width / 2 - 0.5, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#ef4444" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

export const Anomaly3DVisualization: React.FC<Anomaly3DVisualizationProps> = ({
  detections, totalCount, anomalyCount,
}) => {
  const points = useMemo(() => {
    const anomalies = detections.filter(d => d.is_anomaly);
    const normals = detections.filter(d => !d.is_anomaly);
    const maxNormals = Math.max(0, 400 - anomalies.length);
    const sampledNormals = normals.length > maxNormals
      ? normals.filter((_, i) => i % Math.ceil(normals.length / maxNormals) === 0)
      : normals;
    return [...anomalies, ...sampledNormals].sort((a, b) => a.index - b.index);
  }, [detections]);

  if (detections.length === 0) {
    return <div className="text-[11px] text-warm-slate font-mono p-4 text-center">No anomaly data available.</div>;
  }

  const xScale = 12 / Math.max(totalCount, 1);
  const zSpread = 8;

  return (
    <div className="relative h-[450px] w-full rounded-lg overflow-hidden border border-carbon-700/50 bg-gradient-to-b from-carbon-900 to-[#0e0e0e]">
      <Canvas camera={{ position: [10, 6, 10], fov: 45 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 12, 8]} intensity={1.0} />
        <directionalLight position={[-8, 5, -10]} intensity={0.3} color="#9E5839" />
        <pointLight position={[0, 10, 0]} intensity={0.2} />
        <gridHelper args={[20, 20, '#3a3a3a', '#262626']} position={[6, 0, 0]} />
        <ThresholdPlane width={14} depth={10} y={0.6 * 8} />
        {points.map((p) => {
          const x = p.index * xScale;
          const y = p.anomaly_score * 8;
          const z = Math.sin(p.index * 0.7 + p.anomaly_score * 5) * zSpread * 0.4
            + Math.cos(p.index * 1.3) * zSpread * 0.3;
          const radius = p.is_anomaly ? 0.12 + p.anomaly_score * 0.2 : 0.06;
          return (
            <ScatterPoint key={p.index} position={[x, y, z]} isAnomaly={p.is_anomaly} score={p.anomaly_score} index={p.index} radius={radius} />
          );
        })}
        <Html position={[6, -0.8, 4]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div className="text-[10px] font-mono text-[#8a8a8a] whitespace-nowrap">Row Index →</div>
        </Html>
        <Html position={[-1.2, 4, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div className="text-[10px] font-mono text-[#8a8a8a] whitespace-nowrap">↑ Score</div>
        </Html>
        <Html position={[13.5, 0.6 * 8, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="text-[9px] font-mono text-rose-400/70 whitespace-nowrap">← Threshold (0.6)</div>
        </Html>
        <OrbitControls enablePan enableZoom enableRotate minDistance={3} maxDistance={30} target={[6, 3, 0]} />
      </Canvas>
      <div className="absolute top-3 left-3 bg-carbon-900/80 backdrop-blur px-3 py-2 rounded-lg border border-carbon-700/60 space-y-1.5">
        <p className="text-[10px] font-bold text-warm-pale uppercase tracking-wider">Anomaly Detection</p>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-warm-sand">Normal: <span className="text-emerald-400 font-bold">{totalCount - anomalyCount}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-[10px] text-warm-sand">Anomaly: <span className="text-rose-400 font-bold">{anomalyCount}</span></span>
        </div>
        <div className="text-[10px] text-warm-slate font-mono pt-0.5">
          Rate: {totalCount > 0 ? ((anomalyCount / totalCount) * 100).toFixed(1) : 0}%
        </div>
        <div className="w-full h-px bg-carbon-700 my-1" />
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-px border-b border-dashed border-rose-500/60" />
          <span className="text-[9px] text-rose-400/70">Threshold plane (score=0.6)</span>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 bg-carbon-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-carbon-700/60 text-[10px] text-warm-slate flex items-center gap-2">
        <span>🖱️ Drag to rotate</span><span>| Scroll to zoom</span><span>| Right-drag to pan</span>
      </div>
    </div>
  );
};
