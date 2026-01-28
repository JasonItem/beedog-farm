
import React, { useRef, useMemo, useLayoutEffect, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Billboard, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Plot, MAP_COLS, ITEMS, MAP_ROWS } from '../types';

// Fix for missing JSX types in this environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      instancedMesh: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      color: any;
    }
  }
}

const TILE_SIZE = 1;
const TREE_URL = "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/tree.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3UvdHJlZS5wbmciLCJpYXQiOjE3Njk2MzIzNjQsImV4cCI6NDg5MTY5NjM2NH0.t5SzYhbeoeAvFn5Ho4PJP2IdqlTbRtZFMo8Xuwd5Wtk";
const EMOTE_URL = "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/emote.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3UvZW1vdGUucG5nIiwiaWF0IjoxNzY5NjMzMjQyLCJleHAiOjQ4OTE2OTcyNDJ9.uZJd0bdmhirvBIEPqNUJIqwVP-94pQHmVNl3u2hIOeg";
const STONE_URL = "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/stone.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3Uvc3RvbmUucG5nIiwiaWF0IjoxNzY5NjMzNTU5LCJleHAiOjQ4OTE2OTc1NTl9.S4bZncB6QSVmT4IjlDpd8pjabGzJxm3lTd2GYHB4GT4";

const WEED_URLS = [
    "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/grass1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3UvZ3Jhc3MxLnBuZyIsImlhdCI6MTc2OTYzMjg0NCwiZXhwIjo0ODkxNjk2ODQ0fQ.hyFQ2DH7YJdbCAW0kJpbd-ZI5FeZZuXzmIRX_dfUeCs",
    "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/grass2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3UvZ3Jhc3MyLnBuZyIsImlhdCI6MTc2OTYzMjg3MywiZXhwIjo0ODkxNjk2ODczfQ.dXxU-ZUSKMQESEhs8HlCQsTDgRrHHMXpfT6OWXrkOrk",
    "https://zhkbcklljicjplxovutz.supabase.co/storage/v1/object/sign/mifenggou/grass3.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZDc4OGQ0Ny0zOWIwLTRhNGMtYjI3Ni1lNGM0Yzc2M2IwZjkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtaWZlbmdnb3UvZ3Jhc3MzLnBuZyIsImlhdCI6MTc2OTYzMjg4NiwiZXhwIjo0ODkxNjk2ODg2fQ.9Z--gLrDjovYwdp--vj7MW2hrjuy0zNdfq2kXbfXPUg"
];

// --- 颜色定义 ---
const COLORS = {
    grassTop: '#40b226',
    grassSide: '#428e2d',
    soilTop: '#714234',
    soilWet: '#5e382d',
    soilSide: '#714234',
    sandTop: '#F4D086',
    sandSide: '#e3c592',
    stone: '#9E9E9E',
    wood: '#795548',
};

// --- 地块层 (Instanced Mesh, 无光影) ---
const InstancedBlockLayer = React.memo(({ 
    type, 
    plots, 
    geometry, 
    materialTop, 
    materialSide
}: { 
    type: string, 
    plots: Plot[], 
    geometry: THREE.BufferGeometry, 
    materialTop: THREE.Material,
    materialSide: THREE.Material
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const instancePlots = useMemo(() => {
        return plots.filter(p => {
             if (type === 'grass') return p.type === 'grass' || p.type === 'wood' || p.type === 'weed' || p.type === 'stone';
             if (type === 'soil_dry') return p.type === 'soil' && !p.isWatered;
             if (type === 'soil_wet') return p.type === 'soil' && p.isWatered;
             if (type === 'sand') return p.type === 'sand';
             return false;
        });
    }, [plots, type]);

    const materials = useMemo(() => [
        materialSide, materialSide, materialTop, materialSide, materialSide, materialSide
    ], [materialSide, materialTop]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const count = instancePlots.length;
        if (count === 0) return;
        instancePlots.forEach((plot, i) => {
            const col = plot.id % MAP_COLS;
            const row = Math.floor(plot.id / MAP_COLS);
            let y = 0;
            if (type.includes('soil')) y = 0.02; 
            if (type === 'sand') y = -0.1;
            dummy.position.set(col * TILE_SIZE, y, row * TILE_SIZE);
            const scaleXZ = 0.96;
            dummy.scale.set(scaleXZ, type.includes('soil') ? 0.9 : (type === 'sand' ? 0.8 : 1), scaleXZ);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [instancePlots, dummy, type]);

    if (instancePlots.length === 0) return null;
    return <instancedMesh ref={meshRef} args={[geometry, materials, instancePlots.length]} />;
});

// --- 2D Sprite Component (用于树木和作物) ---
const PixelSprite = React.memo(({ 
    imageUrl, 
    position, 
    scale = 1,
    opacity = 1,
    highlight = false 
}: { 
    imageUrl: string, 
    position: [number, number, number], 
    scale?: number | [number, number, number],
    opacity?: number,
    highlight?: boolean
}) => {
    const texture = useTexture(imageUrl);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    const finalScale = Array.isArray(scale) ? scale : [scale, scale, scale] as [number, number, number];
    const isTransparent = opacity < 1;

    return (
        <Billboard position={position} follow={true} lockX={true} lockY={false} lockZ={true}>
             <mesh scale={finalScale}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial 
                    map={texture} 
                    transparent 
                    opacity={opacity}
                    alphaTest={isTransparent ? 0 : 0.5} 
                    depthWrite={!isTransparent} 
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 黄色描边/发光效果 (Selection Outline) */}
            {highlight && (
                <mesh scale={[finalScale[0] * 1.1, finalScale[1] * 1.05, 1]} position={[0, 0, -0.05]}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial 
                        map={texture}
                        transparent
                        color="#FFD700"
                        opacity={0.6}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                        blending={THREE.AdditiveBlending} 
                    />
                </mesh>
            )}
        </Billboard>
    );
});

// --- 成熟作物提示图标 (浮动动画) ---
const ReadyIcon = React.memo(({ position }: { position: [number, number, number] }) => {
    const texture = useTexture(EMOTE_URL);
    useLayoutEffect(() => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
    }, [texture]);
    
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        if (meshRef.current) {
            // 上下浮动动画
            const t = state.clock.elapsedTime;
            meshRef.current.position.y = Math.sin(t * 5) * 0.1; 
        }
    });

    return (
        <Billboard position={position} follow={true} lockX={true} lockZ={true}>
            <mesh ref={meshRef} scale={0.7}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthTest={true} /> 
            </mesh>
        </Billboard>
    );
});

// --- 树木层 (Trees) ---
const TreesLayer = React.memo(({ 
    plots, 
    hoveredPlotId, 
    selectedPlotId 
}: { 
    plots: Plot[], 
    hoveredPlotId: number | null, 
    selectedPlotId: number | null 
}) => {
    useTexture(TREE_URL);

    const treePlots = useMemo(() => {
        return plots.filter(p => p.type === 'wood');
    }, [plots]);

    const isOccluding = (treeId: number, targetId: number | null) => {
        if (targetId === null) return false;
        const tx = targetId % MAP_COLS;
        const tz = Math.floor(targetId / MAP_COLS);
        const treeX = treeId % MAP_COLS;
        const treeZ = Math.floor(treeId / MAP_COLS);
        const dx = treeX - tx;
        const dz = treeZ - tz;
        return dx >= 0 && dx <= 2 && dz >= 0 && dz <= 2 && (dx + dz > 0);
    };

    return (
        <group>
            {treePlots.map(plot => {
                const col = plot.id % MAP_COLS;
                const row = Math.floor(plot.id / MAP_COLS);
                const shouldFade = isOccluding(plot.id, hoveredPlotId) || isOccluding(plot.id, selectedPlotId);
                const isSelected = plot.id === selectedPlotId;

                return (
                    <PixelSprite 
                        key={plot.id} 
                        imageUrl={TREE_URL} 
                        position={[col * TILE_SIZE, 1.85, row * TILE_SIZE]} 
                        scale={[1.8, 3.0, 1]} 
                        opacity={shouldFade ? 0.4 : 1.0}
                        highlight={isSelected}
                    />
                );
            })}
        </group>
    );
});

// --- 杂草层 (Weeds) ---
const WeedsLayer = React.memo(({ 
    plots, 
    selectedPlotId 
}: { 
    plots: Plot[], 
    selectedPlotId: number | null 
}) => {
    WEED_URLS.forEach(url => useTexture(url));

    const weedPlots = useMemo(() => {
        return plots.filter(p => p.type === 'weed');
    }, [plots]);

    return (
        <group>
            {weedPlots.map(plot => {
                const col = plot.id % MAP_COLS;
                const row = Math.floor(plot.id / MAP_COLS);
                // 使用 ID 生成伪随机索引，确保同一块地始终显示同一种草
                const variant = (plot.id * 7 + 3) % 3;
                const isSelected = plot.id === selectedPlotId;

                return (
                    <PixelSprite 
                        key={plot.id} 
                        imageUrl={WEED_URLS[variant]} 
                        position={[col * TILE_SIZE, 0.9, row * TILE_SIZE]} // 高度设定在地面上方一点点
                        scale={0.8}
                        highlight={isSelected}
                    />
                );
            })}
        </group>
    );
});

// --- 石头层 (Rocks) ---
const RocksLayer = React.memo(({ 
    plots, 
    selectedPlotId 
}: { 
    plots: Plot[], 
    selectedPlotId: number | null 
}) => {
    useTexture(STONE_URL);

    const stonePlots = useMemo(() => {
        return plots.filter(p => p.type === 'stone');
    }, [plots]);

    return (
        <group>
            {stonePlots.map(plot => {
                const col = plot.id % MAP_COLS;
                const row = Math.floor(plot.id / MAP_COLS);
                const isSelected = plot.id === selectedPlotId;

                return (
                    <PixelSprite 
                        key={plot.id} 
                        imageUrl={STONE_URL} 
                        position={[col * TILE_SIZE, 0.8, row * TILE_SIZE]} 
                        scale={0.9}
                        highlight={isSelected}
                    />
                );
            })}
        </group>
    );
});

const CropsLayer = React.memo(({ 
    plots, 
    selectedPlotId 
}: { 
    plots: Plot[], 
    selectedPlotId: number | null 
}) => {
    // 预加载贴图
    useTexture(EMOTE_URL);
    
    const plantedPlots = plots.filter(p => p.type === 'soil' && (p.status === 'planted' || p.isWithered));

    return (
        <group>
            {plantedPlots.map(plot => {
                const col = plot.id % MAP_COLS;
                const row = Math.floor(plot.id / MAP_COLS);
                
                let imgUrl = '';
                if (plot.isWithered) {
                    imgUrl = ITEMS['dead_crop'].imageUrl;
                } else if (plot.seedId) {
                    const itemDef = ITEMS[plot.seedId];
                    if (itemDef) {
                        const totalDays = itemDef.growthDays || 1;
                        if (plot.daysPlanted >= totalDays) {
                            const cropId = plot.seedId.replace('seed_', 'crop_');
                            imgUrl = ITEMS[cropId]?.imageUrl || itemDef.imageUrl;
                        } else {
                            const stages = itemDef.growthStages || [];
                            if (stages.length > 0) {
                                const growingStageCount = Math.max(1, stages.length - 1); 
                                const stageIndex = Math.min(growingStageCount - 1, Math.floor((plot.daysPlanted / totalDays) * growingStageCount));
                                imgUrl = stages[stageIndex];
                            } else {
                                imgUrl = itemDef.imageUrl;
                            }
                        }
                    }
                }

                if (!imgUrl) return null;
                const isSelected = plot.id === selectedPlotId;
                const isMature = plot.status === 'planted' && !plot.isWithered && plot.seedId && plot.daysPlanted >= (ITEMS[plot.seedId]?.growthDays || 99);

                return (
                     <React.Fragment key={plot.id}>
                        <PixelSprite 
                            imageUrl={imgUrl} 
                            position={[col * TILE_SIZE, 0.7, row * TILE_SIZE]} 
                            highlight={isSelected}
                        />
                        {isMature && (
                            <ReadyIcon position={[col * TILE_SIZE, 1.5, row * TILE_SIZE]} />
                        )}
                     </React.Fragment>
                );
            })}
        </group>
    );
});

const MapRenderer = React.memo(({ 
    plots, 
    hoveredPlotId, 
    selectedPlotId 
}: { 
    plots: Plot[],
    hoveredPlotId: number | null,
    selectedPlotId: number | null
}) => {
    const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const matGrassTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.grassTop }), []);
    const matGrassSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.grassSide }), []);
    const matSoilTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilTop }), []);
    const matSoilWetTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilWet }), []);
    const matSoilSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilSide }), []);
    const matSandTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.sandTop }), []);
    const matSandSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.sandSide }), []);

    const selectedPlot = selectedPlotId !== null ? plots.find(p => p.id === selectedPlotId) : null;
    const isRockSelected = selectedPlot?.type === 'stone';

    return (
        <group>
            <InstancedBlockLayer type="grass" plots={plots} geometry={boxGeo} materialTop={matGrassTop} materialSide={matGrassSide} />
            <InstancedBlockLayer type="soil_dry" plots={plots} geometry={boxGeo} materialTop={matSoilTop} materialSide={matSoilSide} />
            <InstancedBlockLayer type="soil_wet" plots={plots} geometry={boxGeo} materialTop={matSoilWetTop} materialSide={matSoilSide} />
            <InstancedBlockLayer type="sand" plots={plots} geometry={boxGeo} materialTop={matSandTop} materialSide={matSandSide} />
            
            <Suspense fallback={null}>
                <TreesLayer 
                    plots={plots} 
                    hoveredPlotId={hoveredPlotId} 
                    selectedPlotId={selectedPlotId} 
                />
                <WeedsLayer 
                    plots={plots} 
                    selectedPlotId={selectedPlotId} 
                />
                <RocksLayer 
                    plots={plots} 
                    selectedPlotId={selectedPlotId} 
                />
            </Suspense>
            
            <Suspense fallback={null}>
                <CropsLayer plots={plots} selectedPlotId={selectedPlotId} />
            </Suspense>
        </group>
    );
});

// --- 悬停高亮光标 (遮罩风格) ---
const HoverCursor = ({ position }: { position: [number, number, number] | null }) => {
    if (!position) return null;
    return (
        <group position={position}>
            <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color="#FCD34D" transparent opacity={0.4} />
            </mesh>
        </group>
    );
};

// --- 选中框组件 (遮罩风格，无边框) ---
const SelectionCursor = ({ selectedPlotId }: { selectedPlotId: number | null }) => {
    if (selectedPlotId === null) return null;
    const col = selectedPlotId % MAP_COLS;
    const row = Math.floor(selectedPlotId / MAP_COLS);
    return (
        <group position={[col * TILE_SIZE, 0, row * TILE_SIZE]}>
             <mesh position={[0, 0.515, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color="#FCD34D" transparent opacity={0.4} />
            </mesh>
        </group>
    );
};

interface SceneProps {
    plots: Plot[];
    selectedPlotId: number | null;
    onSelectPlot: (id: number | null) => void;
}

const Scene3D: React.FC<SceneProps> = ({ plots, selectedPlotId, onSelectPlot }) => {
    const centerX = (MAP_COLS * TILE_SIZE) / 2 - 0.5;
    const centerZ = (MAP_ROWS * TILE_SIZE) / 2 - 0.5;
    const SKY_COLOR = '#87CEEB'; 

    const [hoveredPlotId, setHoveredPlotId] = useState<number | null>(null);
    const camOffset = 100;
    const camPos: [number, number, number] = [centerX + camOffset, camOffset * 1.414, centerZ + camOffset];

    const handlePointerMove = useCallback((e: any) => {
        const x = Math.round(e.point.x);
        const z = Math.round(e.point.z);
        const id = z * MAP_COLS + x;
        if (id !== hoveredPlotId) {
             if (x >= 0 && x < MAP_COLS && z >= 0 && z < MAP_ROWS) {
                 setHoveredPlotId(id);
             } else {
                 setHoveredPlotId(null);
             }
        }
    }, [hoveredPlotId]);

    const handlePointerDown = useCallback((e: any) => {}, []);
    
    const handleClick = useCallback((e: any) => {
        const x = Math.round(e.point.x);
        const z = Math.round(e.point.z);
        const id = z * MAP_COLS + x;
        if (x >= 0 && x < MAP_COLS && z >= 0 && z < MAP_ROWS) {
             onSelectPlot(id);
        } else {
             onSelectPlot(null);
        }
    }, [onSelectPlot]);

    const hoveredPos: [number, number, number] | null = useMemo(() => {
        if (hoveredPlotId === null) return null;
        const col = hoveredPlotId % MAP_COLS;
        const row = Math.floor(hoveredPlotId / MAP_COLS);
        return [col * TILE_SIZE, 0, row * TILE_SIZE];
    }, [hoveredPlotId]);

    return (
        <Canvas dpr={[1, 1.5]} className="w-full h-full bg-[#87CEEB]" onPointerMissed={() => onSelectPlot(null)}>
            <color attach="background" args={[SKY_COLOR]} />
            <OrthographicCamera makeDefault position={camPos} zoom={40} near={-500} far={2000} onUpdate={c => c.lookAt(centerX, 0, centerZ)} />
            <OrbitControls 
                enableRotate={true} 
                enableZoom={true} 
                minZoom={10} 
                maxZoom={80}
                target={[centerX, 0, centerZ]}
                dampingFactor={0.2}
                mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
            />
            <mesh position={[centerX, 0.5, centerZ]} rotation={[-Math.PI / 2, 0, 0]} onPointerMove={handlePointerMove} onClick={handleClick}>
                <planeGeometry args={[3000, 3000]} />
                <meshBasicMaterial visible={false} /> 
            </mesh>
             <mesh position={[centerX, -0.65, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[3000, 3000]} />
                <meshBasicMaterial color="#29B6F6" />
            </mesh>
            <MapRenderer plots={plots} hoveredPlotId={hoveredPlotId} selectedPlotId={selectedPlotId} />
            <HoverCursor position={hoveredPos} />
            <SelectionCursor selectedPlotId={selectedPlotId} />
        </Canvas>
    );
};

export default Scene3D;
