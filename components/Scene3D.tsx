
import React, { useRef, useMemo, useLayoutEffect, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Billboard, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Plot, MAP_COLS, ITEMS, MAP_ROWS, TreeType } from '../types';
import { Player, PlayerHandle } from './Player';
import { findPath } from '../utils/pathfinding';
import { RemotePlayerState } from '../services/game';

// Fix for missing JSX types
declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
}

const TILE_SIZE = 1;
const EXTERIOR_URL = "./exterior.png";
const TREES_URL = "./Trees.png";

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

// 地形纹理配置 (用户指定资源_9)
const TERRAIN_TEXTURES = {
    grass: { x: 32, y: 240, w: 16, h: 16 },
};

// 草地装饰物贴图配置
const GRASS_DECOR_CONFIG: Record<number, { x: number, y: number, w: number, h: number }> = {
    1: { x: 208, y: 864, w: 16, h: 16 }, // 装饰1
    2: { x: 80, y: 864, w: 16, h: 16 },  // 装饰2
    3: { x: 112, y: 864, w: 16, h: 16 }, // 装饰3
    4: { x: 96, y: 880, w: 16, h: 16 },  // 装饰4
    5: { x: 64, y: 880, w: 16, h: 16 },  // 装饰5
    6: { x: 208, y: 848, w: 16, h: 16 }  // 装饰6
};

const EXTERIOR_ATLAS_CONFIG: Record<string, Record<number, { x: number, y: number, w: number, h: number }>> = {
    stone: {
        2: { x: 144, y: 816, w: 32, h: 48 }, // 大
        1: { x: 80, y: 832, w: 32, h: 32 },  // 中
        0: { x: 176, y: 832, w: 32, h: 32 }  // 小
    },
    weed: {
        0: { x: 64, y: 448, w: 32, h: 32 },
        1: { x: 96, y: 448, w: 32, h: 32 },
        2: { x: 128, y: 448, w: 32, h: 32 }
    }
};

const TREE_ATLAS_CONFIG: Record<TreeType, Record<number, { x: number, y: number, w: number, h: number }>> = {
    ordinary: {
        2: { x: 0, y: 0, w: 64, h: 80 },
        1: { x: 64, y: 0, w: 64, h: 80 },
        0: { x: 128, y: 0, w: 48, h: 80 }
    },
    fruit: {
        2: { x: 192, y: 0, w: 64, h: 80 },
        1: { x: 256, y: 0, w: 64, h: 80 },
        0: { x: 320, y: 0, w: 32, h: 80 }
    },
    birch: {
        2: { x: 352, y: 0, w: 96, h: 80 },
        1: { x: 448, y: 0, w: 64, h: 80 },
        0: { x: 512, y: 0, w: 64, h: 80 }
    }
};

/**
 * 统一渲染层级逻辑
 */
export const calculateRenderOrder = (z: number, subOrder: number = 0) => {
    return 5000 + Math.floor(z * 100) + subOrder;
};

const TreeSprite = React.memo(({ type, stage, position }: { type: TreeType, stage: number, position: [number, number, number] }) => {
    const tex = useTexture(TREES_URL) as any;
    const atlasW = 576;
    const atlasH = 80;
    const config = TREE_ATLAS_CONFIG[type][stage] || TREE_ATLAS_CONFIG.ordinary[2];

    const texture = useMemo(() => {
        const t = tex.clone();
        t.repeat.set(config.w / atlasW, config.h / atlasH);
        t.offset.set(config.x / atlasW, 1 - (config.h + config.y) / atlasH);
        t.minFilter = THREE.NearestFilter;
        t.magFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
    }, [tex, type, stage]);

    const displayW = config.w / 16;
    const displayH = config.h / 16;

    const visualZ = position[2] + 0.05;
    const visualY = (displayH / 2) + 0.5;
    const order = calculateRenderOrder(visualZ, 50);

    return (
        <Billboard position={[position[0], visualY, visualZ]}>
            <mesh scale={[displayW, displayH, 1]} renderOrder={order}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} transparent alphaTest={0.5} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
        </Billboard>
    );
});

const ExteriorSprite = React.memo(({ category, variation, position }: { category: 'stone' | 'weed', variation: number, position: [number, number, number] }) => {
    const tex = useTexture(EXTERIOR_URL) as any;
    const atlasW = 272;
    const atlasH = 912;

    const safeVariation = variation !== undefined && variation !== null ? variation : 0;
    const config = EXTERIOR_ATLAS_CONFIG[category][safeVariation] || EXTERIOR_ATLAS_CONFIG[category][0];

    const texture = useMemo(() => {
        const t = tex.clone();
        t.repeat.set(config.w / atlasW, config.h / atlasH);
        t.offset.set(config.x / atlasW, 1 - (config.h + config.y) / atlasH);
        t.minFilter = THREE.NearestFilter;
        t.magFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
    }, [tex, category, safeVariation]);

    const displayW = config.w / 16;
    const displayH = config.h / 16;

    const visualZ = position[2];
    const visualY = (displayH / 2) + 0.5;
    const order = calculateRenderOrder(visualZ, category === 'stone' ? 10 : 5);

    return (
        <Billboard position={[position[0], visualY, visualZ]}>
            <mesh scale={[displayW, displayH, 1]} renderOrder={order} raycast={() => null}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} transparent alphaTest={0.5} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
        </Billboard>
    );
});

// 新增：草地装饰物图层 (InstancedMesh)
const GrassDecorLayer = React.memo(({ plots }: { plots: Plot[] }) => {
    const tex = useTexture(EXTERIOR_URL) as any;
    const atlasW = 272;
    const atlasH = 912;

    const decorPlots = useMemo(() => plots.filter(p => p.type === 'grass' && p.grassDecor), [plots]);

    const mat = useMemo(() => {
        const t = tex.clone();
        t.minFilter = THREE.NearestFilter;
        t.magFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5 });
    }, [tex]);

    const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const meshRef = useRef<THREE.InstancedMesh>(null);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const dummy = new THREE.Object3D();
        decorPlots.forEach((p, i) => {
            const col = p.id % MAP_COLS;
            const row = Math.floor(p.id / MAP_COLS);
            const config = GRASS_DECOR_CONFIG[p.grassDecor!] || GRASS_DECOR_CONFIG[1];

            // 设置位置：在草块表面上方一点点
            dummy.position.set(col, 0.51, row);
            dummy.rotation.x = -Math.PI / 2; // 平铺在表面
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);

            // 通过 UV 属性设置贴图偏移 (InstancedMesh 共享材质，需要特殊处理，但这里我们先用简单的偏移)
            // 提示：如果要完美支持不同 UV，需要使用 shader 或每种装饰物单独一个 InstancedMesh
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [decorPlots]);

    // 这里由于不同装饰物 UV 不同，为简单起见，我们按类型分组渲染或使用 Billboard
    // 改用渲染列表方式，避免 Shader 开发复杂度
    return (
        <group>
            {decorPlots.map(p => {
                const config = GRASS_DECOR_CONFIG[p.grassDecor!] || GRASS_DECOR_CONFIG[1];
                const col = p.id % MAP_COLS;
                const row = Math.floor(p.id / MAP_COLS);
                return (
                    <mesh key={p.id} position={[col, 0.51, row]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                        <planeGeometry args={[0.8, 0.8]} />
                        <meshBasicMaterial
                            transparent
                            alphaTest={0.5}
                            map={(() => {
                                const t = tex.clone();
                                t.repeat.set(config.w / atlasW, config.h / atlasH);
                                t.offset.set(config.x / atlasW, 1 - (config.h + config.y) / atlasH);
                                t.minFilter = THREE.NearestFilter;
                                t.magFilter = THREE.NearestFilter;
                                t.needsUpdate = true;
                                return t;
                            })()}
                        />
                    </mesh>
                );
            })}
        </group>
    );
});

const InstancedBlockLayer = React.memo(({ type, plots, geometry, materialTop, materialSide }: any) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const atlasTexture = useTexture(EXTERIOR_URL) as any;
    const atlasW = 272;
    const atlasH = 912;

    const instancePlots = useMemo(() => plots.filter((p: Plot) => {
        if (type === 'grass') return p.type === 'grass' || p.type === 'wood' || p.type === 'weed' || p.type === 'stone';
        if (type === 'soil_dry') return p.type === 'soil' && !p.isWatered;
        if (type === 'soil_wet') return p.type === 'soil' && p.isWatered;
        if (type === 'sand') return p.type === 'sand';
        return false;
    }), [plots, type]);

    const customMaterialTop = useMemo(() => {
        if (type === 'grass') {
            const config = TERRAIN_TEXTURES.grass;
            const tex = atlasTexture.clone();
            tex.repeat.set(config.w / atlasW, config.h / atlasH);
            tex.offset.set(config.x / atlasW, 1 - (config.h + config.y) / atlasH);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            return new THREE.MeshBasicMaterial({ map: tex });
        }
        return materialTop;
    }, [type, atlasTexture, materialTop]);

    const materials = useMemo(() => [materialSide, materialSide, customMaterialTop, materialSide, materialSide, materialSide], [materialSide, customMaterialTop]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        instancePlots.forEach((plot: Plot, i: number) => {
            const col = plot.id % MAP_COLS;
            const row = Math.floor(plot.id / MAP_COLS);
            let y = 0;
            if (type.includes('soil')) y = 0.02;
            if (type === 'sand') y = -0.1;
            dummy.position.set(col * TILE_SIZE, y, row * TILE_SIZE);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.renderOrder = 0;
    }, [instancePlots, dummy, type]);

    if (instancePlots.length === 0) return null;
    return <instancedMesh ref={meshRef} args={[geometry, materials, instancePlots.length]} raycast={() => null} />;
});

const PixelSprite = React.memo(({ imageUrl, position, scale = 1, surfaceY = 0.5 }: any) => {
    const texture = useTexture(imageUrl) as any;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const finalScale = Array.isArray(scale) ? scale : [scale, scale, 1];

    const visualZ = position[2];
    const visualY = surfaceY + (finalScale[1] / 2);
    const order = calculateRenderOrder(visualZ, 20);

    return (
        <Billboard position={[position[0], visualY, visualZ]}>
            <mesh scale={finalScale as any} raycast={() => null} renderOrder={order}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} transparent alphaTest={0.5} depthWrite={false} />
            </mesh>
        </Billboard>
    );
});

const CropsLayer = React.memo(({ plots }: { plots: Plot[] }) => {
    const plantedPlots = useMemo(() => plots.filter(p => p.type === 'soil' && (p.status === 'planted' || p.isWithered)), [plots]);
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
                        if (plot.daysPlanted >= totalDays) {
                            const cropId = plot.seedId.replace('seed_', 'crop_');
                            imgUrl = ITEMS[cropId]?.imageUrl || itemDef.imageUrl;
                        } else {
                            const stages = itemDef.growthStages || [];
                            if (stages.length > 0) {
                                const stageIndex = Math.min(stages.length - 1, Math.floor((plot.daysPlanted / totalDays) * stages.length));
                                imgUrl = stages[stageIndex];
                            } else imgUrl = itemDef.imageUrl;
                        }
                    }
                }
                if (!imgUrl) return null;
                return <PixelSprite key={plot.id} imageUrl={imgUrl} position={[col, 0, row]} scale={0.8} surfaceY={0.52} />;
            })}
        </group>
    );
});

const MapRenderer = React.memo(({ plots }: any) => {
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

            <GrassDecorLayer plots={plots} />

            {plots.map((p: Plot) => {
                const col = p.id % MAP_COLS;
                const row = Math.floor(p.id / MAP_COLS);
                if (p.type === 'wood' && p.treeType !== undefined) {
                    return <TreeSprite key={p.id} type={p.treeType} stage={p.treeStage ?? 2} position={[col, 0, row]} />;
                }
                if (p.type === 'stone') {
                    return <ExteriorSprite key={p.id} category="stone" variation={p.variation} position={[col, 0, row]} />;
                }
                if (p.type === 'weed') {
                    return <ExteriorSprite key={p.id} category="weed" variation={p.variation} position={[col, 0, row]} />;
                }
                return null;
            })}
            <CropsLayer plots={plots} />
        </group>
    );
});

const Scene3D: React.FC<any> = ({ plots, selectedPlotId, playerName, onSelectPlot, remotePlayers = [], onLocalMove, farmOwnerId, isVisiting }) => {
    const centerX = MAP_COLS / 2;
    const centerZ = MAP_ROWS / 2;
    const playerRef = useRef<PlayerHandle>(null);
    const [hoveredPlotId, setHoveredPlotId] = useState<number | null>(null);

    const handleClick = useCallback((e: any) => {
        const x = Math.round(e.point.x);
        const z = Math.round(e.point.z);
        if (x < 0 || x >= MAP_COLS || z < 0 || z >= MAP_ROWS) return;

        let id = z * MAP_COLS + x;
        const targetPlot = plots[id];

        if (targetPlot && (targetPlot.type === 'grass' || (targetPlot.type === 'soil' && targetPlot.status === 'empty'))) {
            const aboveId = (z - 1) * MAP_COLS + x;
            if (aboveId >= 0 && plots[aboveId]?.type === 'wood') {
                id = aboveId;
            }
        }

        if (playerRef.current) {
            const startX = Math.round(playerRef.current.position.x);
            const startZ = Math.round(playerRef.current.position.z);
            if (startX === x && startZ === z) { onSelectPlot(id); return; }
            const pathPoints = findPath({ x: startX, y: startZ }, { x: x, y: z }, plots);
            if (pathPoints) {
                const pathVectors = pathPoints.map(p => new THREE.Vector3(p.x, 0, p.y));
                playerRef.current.walkTo(pathVectors, () => onSelectPlot(id));
            }
        }
    }, [onSelectPlot, plots]);

    const handlePointerMove = useCallback((e: any) => {
        const x = Math.round(e.point.x);
        const z = Math.round(e.point.z);
        if (x < 0 || x >= MAP_COLS || z < 0 || z >= MAP_ROWS) {
            setHoveredPlotId(null);
            return;
        }
        setHoveredPlotId(z * MAP_COLS + x);
    }, []);

    return (
        <Canvas dpr={[1, 1.5]} className="w-full h-full bg-[#87CEEB]" onPointerMissed={() => onSelectPlot(null)}>
            <color attach="background" args={['#87CEEB']} />
            <OrthographicCamera makeDefault position={[centerX, 100, centerZ + 40]} zoom={40} near={-500} far={2000} onUpdate={c => c.lookAt(centerX, 0, centerZ)} />
            <OrbitControls
                enableRotate={false}
                enableZoom={true}
                enablePan={true}
                minZoom={1}
                maxZoom={100}
                target={[centerX, 0, centerZ]}
                dampingFactor={0.2}
                mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null }}
                touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
            />
            <Suspense fallback={null}>
                <MapRenderer plots={plots} />
                <Player ref={playerRef} initialPos={[centerX, 0, centerZ]} playerName={playerName} onPositionChange={onLocalMove} isOwner={!isVisiting} />
                {remotePlayers.map((p: any) => (
                    <Player key={p.id} isRemote externalState={p} playerName={p.name} isOwner={p.id === farmOwnerId} />
                ))}
            </Suspense>

            <mesh position={[centerX, 0.01, centerZ]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick} onPointerMove={handlePointerMove} onPointerLeave={() => setHoveredPlotId(null)}>
                <planeGeometry args={[MAP_COLS, MAP_ROWS]} />
                <meshBasicMaterial visible={false} />
            </mesh>

            {hoveredPlotId !== null && (
                <mesh position={[(hoveredPlotId % MAP_COLS), 0.52, Math.floor(hoveredPlotId / MAP_COLS)]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial color="white" transparent opacity={0.2} />
                </mesh>
            )}

            {selectedPlotId !== null && (
                <mesh position={[(selectedPlotId % MAP_COLS), 0.53, Math.floor(selectedPlotId / MAP_COLS)]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[1.05, 1.05]} />
                    <meshBasicMaterial color="white" transparent opacity={0.4} />
                </mesh>
            )}

            <mesh position={[centerX, -0.6, centerZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial color="#29B6F6" />
            </mesh>
        </Canvas>
    );
};

export default Scene3D;
