import React, { useRef, useMemo, useLayoutEffect, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Billboard, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Plot, MAP_COLS, ITEMS, MAP_ROWS } from '../types';
import { Player, PlayerHandle } from './Player';
import { findPath } from '../utils/pathfinding';
import { RemotePlayerState } from '../services/game';

// Fix for missing JSX types in this environment
declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
}

const TILE_SIZE = 1;
const TREE_URL = "./tree.png";
const EMOTE_URL = "./emote.png";
const STONE_URL = "./stone.png";
const WEED_URLS = ["./grass1.png", "./grass2.png", "./grass3.png"];

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
            dummy.scale.set(1.0, type.includes('soil') ? 0.9 : (type === 'sand' ? 0.8 : 1), 1.0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [instancePlots, dummy, type]);

    if (instancePlots.length === 0) return null;
    return <instancedMesh ref={meshRef} args={[geometry, materials, instancePlots.length]} raycast={() => null} />;
});

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
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const finalScale = Array.isArray(scale) ? scale : [scale, scale, scale] as [number, number, number];
    const isTransparent = opacity < 1;

    return (
        <Billboard position={position} follow={true} lockX={true} lockY={false} lockZ={true}>
            <mesh scale={finalScale} raycast={() => null}>
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

            {highlight && (
                <mesh scale={[finalScale[0] * 1.1, finalScale[1] * 1.05, 1]} position={[0, 0, -0.05]} raycast={() => null}>
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

const ReadyIcon = React.memo(({ position }: { position: [number, number, number] }) => {
    const texture = useTexture(EMOTE_URL);
    useLayoutEffect(() => {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
    }, [texture]);

    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 5) * 0.1;
        }
    });

    return (
        <Billboard position={position} follow={true} lockX={true} lockZ={true}>
            <mesh ref={meshRef} scale={0.7} raycast={() => null}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthTest={true} />
            </mesh>
        </Billboard>
    );
});

const TreesLayer = React.memo(({ plots, hoveredPlotId, selectedPlotId }: { plots: Plot[], hoveredPlotId: number | null, selectedPlotId: number | null }) => {
    const treePlots = useMemo(() => plots.filter(p => p.type === 'wood'), [plots]);
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
                return (
                    <PixelSprite
                        key={plot.id}
                        imageUrl={TREE_URL}
                        position={[col * TILE_SIZE, 1.85, row * TILE_SIZE]}
                        scale={[1.8, 3.0, 1]}
                        opacity={shouldFade ? 0.4 : 1.0}
                        highlight={plot.id === selectedPlotId}
                    />
                );
            })}
        </group>
    );
});

const WeedsLayer = React.memo(({ plots, selectedPlotId }: { plots: Plot[], selectedPlotId: number | null }) => {
    const weedPlots = useMemo(() => plots.filter(p => p.type === 'weed'), [plots]);
    return (
        <group>
            {weedPlots.map(plot => (
                <PixelSprite
                    key={plot.id}
                    imageUrl={WEED_URLS[(plot.id * 7 + 3) % 3]}
                    position={[(plot.id % MAP_COLS) * TILE_SIZE, 0.9, Math.floor(plot.id / MAP_COLS) * TILE_SIZE]}
                    scale={0.8}
                    highlight={plot.id === selectedPlotId}
                />
            ))}
        </group>
    );
});

const RocksLayer = React.memo(({ plots, selectedPlotId }: { plots: Plot[], selectedPlotId: number | null }) => {
    const stonePlots = useMemo(() => plots.filter(p => p.type === 'stone'), [plots]);
    return (
        <group>
            {stonePlots.map(plot => (
                <PixelSprite
                    key={plot.id}
                    imageUrl={STONE_URL}
                    position={[(plot.id % MAP_COLS) * TILE_SIZE, 0.8, Math.floor(plot.id / MAP_COLS) * TILE_SIZE]}
                    scale={0.9}
                    highlight={plot.id === selectedPlotId}
                />
            ))}
        </group>
    );
});

const CropsLayer = React.memo(({ plots, selectedPlotId }: { plots: Plot[], selectedPlotId: number | null }) => {
    const plantedPlots = plots.filter(p => p.type === 'soil' && (p.status === 'planted' || p.isWithered));
    return (
        <group>
            {plantedPlots.map(plot => {
                const col = plot.id % MAP_COLS;
                const row = Math.floor(plot.id / MAP_COLS);
                let imgUrl = '';
                if (plot.isWithered) imgUrl = ITEMS['dead_crop'].imageUrl;
                else if (plot.seedId) {
                    const itemDef = ITEMS[plot.seedId];
                    if (itemDef) {
                        const totalDays = itemDef.growthDays || 1;
                        if (plot.daysPlanted >= totalDays) imgUrl = ITEMS[plot.seedId.replace('seed_', 'crop_')]?.imageUrl || itemDef.imageUrl;
                        else {
                            const stages = itemDef.growthStages || [];
                            if (stages.length > 0) imgUrl = stages[Math.min(stages.length - 2, Math.floor((plot.daysPlanted / totalDays) * (stages.length - 1)))];
                            else imgUrl = itemDef.imageUrl;
                        }
                    }
                }
                if (!imgUrl) return null;
                const isMature = plot.status === 'planted' && !plot.isWithered && plot.seedId && plot.daysPlanted >= (ITEMS[plot.seedId]?.growthDays || 99);
                return (
                    <React.Fragment key={plot.id}>
                        <PixelSprite imageUrl={imgUrl} position={[col * TILE_SIZE, 0.7, row * TILE_SIZE]} highlight={plot.id === selectedPlotId} />
                        {isMature && <ReadyIcon position={[col * TILE_SIZE, 1.5, row * TILE_SIZE]} />}
                    </React.Fragment>
                );
            })}
        </group>
    );
});

const MapRenderer = React.memo(({ plots, hoveredPlotId, selectedPlotId }: { plots: Plot[], hoveredPlotId: number | null, selectedPlotId: number | null }) => {
    const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const matGrassTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.grassTop }), []);
    const matGrassSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.grassSide }), []);
    const matSoilTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilTop }), []);
    const matSoilWetTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilWet }), []);
    const matSoilSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.soilSide }), []);
    const matSandTop = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.sandTop }), []);
    const matSandSide = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.sandSide }), []);

    return (
        <group>
            <InstancedBlockLayer type="grass" plots={plots} geometry={boxGeo} materialTop={matGrassTop} materialSide={matGrassSide} />
            <InstancedBlockLayer type="soil_dry" plots={plots} geometry={boxGeo} materialTop={matSoilTop} materialSide={matSoilSide} />
            <InstancedBlockLayer type="soil_wet" plots={plots} geometry={boxGeo} materialTop={matSoilWetTop} materialSide={matSoilSide} />
            <InstancedBlockLayer type="sand" plots={plots} geometry={boxGeo} materialTop={matSandTop} materialSide={matSandSide} />
            <Suspense fallback={null}>
                <TreesLayer plots={plots} hoveredPlotId={hoveredPlotId} selectedPlotId={selectedPlotId} />
                <WeedsLayer plots={plots} selectedPlotId={selectedPlotId} />
                <RocksLayer plots={plots} selectedPlotId={selectedPlotId} />
                <CropsLayer plots={plots} selectedPlotId={selectedPlotId} />
            </Suspense>
        </group>
    );
});

interface SceneProps {
    plots: Plot[];
    selectedPlotId: number | null;
    playerName?: string;
    onSelectPlot: (id: number | null) => void;
    // 多人同步 props
    remotePlayers?: RemotePlayerState[];
    onLocalMove?: (moveData: { x: number, z: number, direction: string, action: string }) => void;
    farmOwnerId?: string;
    isVisiting?: boolean; // 新增：当前是否处于参观模式
}

const Scene3D: React.FC<SceneProps> = ({
                                           plots,
                                           selectedPlotId,
                                           playerName,
                                           onSelectPlot,
                                           remotePlayers = [],
                                           onLocalMove,
                                           farmOwnerId,
                                           isVisiting = false
                                       }) => {
    const centerX = (MAP_COLS * TILE_SIZE) / 2 - 0.5;
    const centerZ = (MAP_ROWS * TILE_SIZE) / 2 - 0.5;
    const [hoveredPlotId, setHoveredPlotId] = useState<number | null>(null);
    const playerRef = useRef<PlayerHandle>(null);

    const handlePointerMove = useCallback((e: any) => {
        const x = Math.round(e.point.x);
        const z = Math.round(e.point.z);
        // 增加严格的边界检查
        if (x >= 0 && x < MAP_COLS && z >= 0 && z < MAP_ROWS) {
            const id = z * MAP_COLS + x;
            if (id !== hoveredPlotId) setHoveredPlotId(id);
        } else {
            setHoveredPlotId(null);
        }
    }, [hoveredPlotId]);

    const handleClick = useCallback((e: any) => {
        const targetPoint = e.point;
        const endX = Math.round(targetPoint.x);
        const endZ = Math.round(targetPoint.z);

        // 边界检查，防止点击地图外导致异常位移
        if (endX < 0 || endX >= MAP_COLS || endZ < 0 || endZ >= MAP_ROWS) {
            onSelectPlot(null);
            return;
        }

        const id = endZ * MAP_COLS + endX;
        onSelectPlot(null);

        if (playerRef.current) {
            const startX = Math.round(playerRef.current.position.x);
            const startZ = Math.round(playerRef.current.position.z);

            // 如果点击的是脚下地块，直接选中
            if (startX === endX && startZ === endZ) {
                onSelectPlot(id);
                return;
            }

            const pathPoints = findPath({ x: startX, y: startZ }, { x: endX, y: endZ }, plots);
            if (pathPoints) {
                const pathVectors = pathPoints.map(p => new THREE.Vector3(p.x, 0, p.y));
                playerRef.current.walkTo(pathVectors, () => {
                    // 到达后再次确认是否在范围内
                    if (endX >= 0 && endX < MAP_COLS && endZ >= 0 && endZ < MAP_ROWS) {
                        onSelectPlot(id);
                    }
                });
            }
        }
    }, [onSelectPlot, plots]);

    const hoveredPos: [number, number, number] | null = useMemo(() => {
        if (hoveredPlotId === null) return null;
        return [(hoveredPlotId % MAP_COLS) * TILE_SIZE, 0, Math.floor(hoveredPlotId / MAP_COLS) * TILE_SIZE];
    }, [hoveredPlotId]);

    return (
        <Canvas dpr={[1, 1.5]} className="w-full h-full bg-[#87CEEB]" onPointerMissed={() => onSelectPlot(null)}>
            <color attach="background" args={['#87CEEB']} />
            <OrthographicCamera makeDefault position={[centerX + 40, 56, centerZ + 40]} zoom={40} near={-500} far={2000} onUpdate={c => c.lookAt(centerX, 0, centerZ)} />
            <OrbitControls
                enableRotate={false}
                enableZoom={true}
                minZoom={20}
                maxZoom={80}
                target={[centerX, 0, centerZ]}
                dampingFactor={0.2}
                mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null }}
                touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
            />

            <Suspense fallback={null}>
                {/* 本地玩家 */}
                <Player
                    ref={playerRef}
                    initialPos={[centerX, 0, centerZ]}
                    playerName={playerName}
                    onPositionChange={onLocalMove}
                    isOwner={!isVisiting}
                />

                {/* 远程玩家们 */}
                {remotePlayers.map(p => (
                    <Player
                        key={p.id}
                        isRemote
                        externalState={p}
                        playerName={p.name}
                        isOwner={p.id === farmOwnerId}
                    />
                ))}
            </Suspense>

            {/* 点击层：确保它是唯一接收 pointer 事件的层 */}
            <mesh position={[centerX, 0.5, centerZ]} rotation={[-Math.PI / 2, 0, 0]} onPointerMove={handlePointerMove} onClick={handleClick}>
                <planeGeometry args={[MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE]} />
                <meshBasicMaterial visible={false} />
            </mesh>

            <mesh position={[centerX, -0.65, centerZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <planeGeometry args={[3000, 3000]} />
                <meshBasicMaterial color="#29B6F6" />
            </mesh>

            <MapRenderer plots={plots} hoveredPlotId={hoveredPlotId} selectedPlotId={selectedPlotId} />

            {hoveredPos && (
                <group position={hoveredPos}>
                    <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                        <planeGeometry args={[1, 1]} /><meshBasicMaterial color="#FCD34D" transparent opacity={0.4} />
                    </mesh>
                </group>
            )}
            {selectedPlotId !== null && (
                <group position={[(selectedPlotId % MAP_COLS) * TILE_SIZE, 0, Math.floor(selectedPlotId / MAP_COLS) * TILE_SIZE]}>
                    <mesh position={[0, 0.515, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                        <planeGeometry args={[1, 1]} /><meshBasicMaterial color="#FCD34D" transparent opacity={0.4} />
                    </mesh>
                </group>
            )}
        </Canvas>
    );
};

export default Scene3D;