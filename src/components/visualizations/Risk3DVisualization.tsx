import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MineRiskResult } from '../../services/mlClient';

interface Risk3DVisualizationProps {
  mines: MineRiskResult[];
}

const RISK_DIMENSIONS: { key: keyof MineRiskResult; label: string }[] = [
  { key: 'safety_risk', label: 'Safety' },
  { key: 'compliance_risk', label: 'Compliance' },
  { key: 'environment_risk', label: 'Environment' },
  { key: 'equipment_risk', label: 'Equipment' },
  { key: 'contractor_risk', label: 'Contractor' },
  { key: 'operations_risk', label: 'Operations' },
];

const BAND_COLORS: Record<string, string> = {
  Low: '#22c55e',
  Moderate: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
};

interface BarProps {
  position: [number, number, number];
  height: number;
  color: string;
  mineName: string;
  riskValue: number;
}

function RiskBar({ position, height, color, mineName, riskValue }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, hovered ? 1.08 : 1, 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        scale={[1, 1, 1]}
      >
        <boxGeometry args={[0.7, height, 0.7]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.5 : 0.15} roughness={0.5} metalness={0.1} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.7, height, 0.7)]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </lineSegments>
      {hovered && (
        <Html position={[0, height + 0.5, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="bg-carbon-900 border border-copper/40 text-copper-light px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap shadow-lg">
            {mineName}: {riskValue.toFixed(1)}
          </div>
        </Html>
      )}
    </group>
  );
}

export const Risk3DVisualization: React.FC<Risk3DVisualizationProps> = ({ mines }) => {
  const data = useMemo(() => {
    const positions: { pos: [number, number, number]; height: number; color: string; mineName: string; value: number }[] = [];
    mines.forEach((mine, mi) => {
      RISK_DIMENSIONS.forEach((dim, di) => {
        const value = mine[dim.key] as number;
        positions.push({
          pos: [di * 1.4, Math.max(value, 0.05) / 2, -mi * 1.6],
          height: Math.max(value, 0.05),
          color: BAND_COLORS[mine.risk_band] || '#f59e0b',
          mineName: mine.mine_name,
          value,
        });
      });
    });
    return positions;
  }, [mines]);

  if (mines.length === 0) {
    return <div className="text-[11px] text-warm-slate font-mono p-4 text-center">No risk data available to render 3D view.</div>;
  }

  return (
    <div className="relative h-[420px] w-full rounded-lg overflow-hidden border border-carbon-700/50 bg-gradient-to-b from-carbon-900 to-[#0e0e0e]">
      <Canvas camera={{ position: [14, 12, 14], fov: 45 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 15, 8]} intensity={1.1} />
        <directionalLight position={[-10, -5, -8]} intensity={0.3} color="#9E5839" />
        <pointLight position={[0, 8, 0]} intensity={0.3} />
        <gridHelper args={[24, 20, '#3a3a3a', '#262626']} position={[4, 0.01, -5]} />
        {RISK_DIMENSIONS.map((dim, di) => (
          <Text key={dim.label} position={[di * 1.4, -0.4, 1.0]} fontSize={0.5} color="#8a8a8a" rotation={[-Math.PI / 2, 0, 0]}>
            {dim.label}
          </Text>
        ))}
        {mines.map((mine, mi) => (
          <Text key={mine.mine_id} position={[-1.2, -0.4, -mi * 1.6]} fontSize={0.4} color="#a8a29e" rotation={[-Math.PI / 2, 0, 0]} maxWidth={2.5}>
            {mine.mine_name.length > 14 ? mine.mine_name.substring(0, 12) + '…' : mine.mine_name}
          </Text>
        ))}
        {data.map((d, i) => (
          <RiskBar key={i} position={d.pos} height={d.height} color={d.color} mineName={d.mineName} riskValue={d.value} />
        ))}
        <OrbitControls enablePan enableZoom enableRotate minDistance={4} maxDistance={40} target={[4, 3, -4]} />
      </Canvas>
      <div className="absolute top-3 left-3 bg-carbon-900/80 backdrop-blur px-3 py-2 rounded-lg border border-carbon-700/60">
        <p className="text-[10px] font-bold text-warm-pale mb-1.5 uppercase tracking-wider">Risk Band</p>
        <div className="space-y-1">
          {(['Low', 'Moderate', 'High', 'Critical'] as const).map(band => (
            <div key={band} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAND_COLORS[band] }} />
              <span className="text-[10px] text-warm-sand">{band}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 bg-carbon-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-carbon-700/60 text-[10px] text-warm-slate flex items-center gap-2">
        <span>🖱️ Drag to rotate</span>
        <span>| Scroll to zoom</span>
        <span>| Right-drag to pan</span>
      </div>
    </div>
  );
};
