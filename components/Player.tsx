
import React, { useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RemotePlayerState } from '../services/game';
import { calculateRenderOrder } from './Scene3D';

const ANIM_CONFIG = {
    up_idle:   { folder: '向上待机', prefix: '向上待机-', count: 5 },
    up_walk:   { folder: '向上行走', prefix: '向上走-',   count: 4 },
    down_idle: { folder: '向下待机', prefix: '向下待机-', count: 5 },
    down_walk: { folder: '向下行走', prefix: '向下行走-', count: 6 },
    side_idle: { folder: '向左右待机', prefix: '向左待机-', count: 5 },
    side_walk: { folder: '向左右行走', prefix: '左行走-',   count: 6 },
};

type Direction = 'up' | 'down' | 'left' | 'right';
type Action = 'idle' | 'walk';
type AnimKey = keyof typeof ANIM_CONFIG;

const ALL_PATHS: string[] = [];
const KEY_TO_START_IDX: Record<string, number> = {};
let globalIdx = 0;
Object.entries(ANIM_CONFIG).forEach(([key, cfg]) => {
    KEY_TO_START_IDX[key] = globalIdx;
    for(let i = 0; i < cfg.count; i++) {
        ALL_PATHS.push(`./${cfg.folder}/${cfg.prefix}${i}.png`);
        globalIdx++;
    }
});

export interface PlayerHandle {
    walkTo: (path: THREE.Vector3[], onArrived?: () => void) => void;
    position: THREE.Vector3;
}

interface PlayerProps {
    initialPos?: [number, number, number];
    playerName?: string;
    isRemote?: boolean;
    isOwner?: boolean;
    externalState?: RemotePlayerState;
    onPositionChange?: (moveData: { x: number, z: number, direction: string, action: string }) => void;
}

export const Player = forwardRef<PlayerHandle, PlayerProps>(({
                                                                 initialPos = [64, 0, 142],
                                                                 playerName = "冒险家",
                                                                 isRemote = false,
                                                                 isOwner = false,
                                                                 externalState,
                                                                 onPositionChange
                                                             }, ref) => {
    const { camera, controls } = useThree();
    const meshRef = useRef<THREE.Mesh>(null);

    const logicPos = useRef(new THREE.Vector3(...initialPos));
    const renderPos = useRef(new THREE.Vector3(...initialPos));
    const lastRenderPos = useRef(new THREE.Vector3(...initialPos));
    const lastSentAction = useRef<string>('idle');
    const lastUpdateTime = useRef<number>(Date.now());

    const pathQueue = useRef<THREE.Vector3[]>([]);
    const isMoving = useRef(false);
    const onArriveCallback = useRef<(() => void) | null>(null);

    const [direction, setDirection] = useState<Direction>((externalState?.direction as Direction) || 'down');
    const [action, setAction] = useState<Action>((externalState?.action as Action) || 'idle');
    const [frameIndex, setFrameIndex] = useState(0);

    const textures = useTexture(ALL_PATHS);

    useMemo(() => {
        textures.forEach(t => {
            if (t) {
                t.minFilter = THREE.NearestFilter;
                t.magFilter = THREE.NearestFilter;
                t.generateMipmaps = false;
                t.colorSpace = THREE.SRGBColorSpace;
            }
        });
    }, [textures]);

    React.useEffect(() => {
        if (isRemote && externalState) {
            logicPos.current.set(externalState.x, 0, externalState.z);
            setDirection(externalState.direction as Direction);
            setAction(externalState.action as Action);
            lastUpdateTime.current = Date.now();
        }
    }, [isRemote, externalState]);

    useImperativeHandle(ref, () => ({
        walkTo: (path: THREE.Vector3[], onArrived?: () => void) => {
            if (isRemote) return;
            if (path.length <= 1) { if (onArrived) onArrived(); return; }
            pathQueue.current = path.slice(1);
            isMoving.current = true;
            onArriveCallback.current = onArrived || null;
        },
        position: renderPos.current
    }));

    useFrame((state, delta) => {
        const safeDelta = Math.min(delta, 0.1);

        if (!isRemote && isMoving.current && pathQueue.current.length > 0) {
            const moveSpeed = 8.5;
            let distToMove = moveSpeed * safeDelta;
            while (distToMove > 0 && pathQueue.current.length > 0) {
                const target = pathQueue.current[0];
                const toTarget = new THREE.Vector3().subVectors(target, logicPos.current);
                const distance = toTarget.length();
                if (distance <= distToMove) {
                    logicPos.current.copy(target);
                    distToMove -= distance;
                    pathQueue.current.shift();
                }
                else {
                    logicPos.current.add(toTarget.normalize().multiplyScalar(distToMove));
                    distToMove = 0;
                }
            }
            if (pathQueue.current.length === 0) {
                isMoving.current = false;
                if (onArriveCallback.current) {
                    onArriveCallback.current();
                    onArriveCallback.current = null;
                }
            }
        }

        if (isRemote && action === 'walk' && Date.now() - lastUpdateTime.current > 1200) {
            setAction('idle');
        }

        renderPos.current.lerp(logicPos.current, isRemote ? 0.15 : 0.85);

        // 使用统一的层级计算逻辑，角色优先级设为 30，高于杂草、石头，低于成熟的大树
        if (meshRef.current) {
            meshRef.current.renderOrder = calculateRenderOrder(renderPos.current.z, 30);
        }

        if (!isRemote) {
            const moveVec = new THREE.Vector3().subVectors(renderPos.current, lastRenderPos.current);
            const currentVelocity = moveVec.length() / safeDelta;
            let nextAction: Action = action;
            let nextDir: Direction = direction;

            if (currentVelocity > 0.08) {
                nextAction = 'walk';
                if (Math.abs(moveVec.z) > Math.abs(moveVec.x)) {
                    nextDir = moveVec.z > 0 ? 'down' : 'up';
                } else {
                    nextDir = moveVec.x > 0 ? 'right' : 'left';
                }
            } else {
                nextAction = 'idle';
            }

            if (nextAction !== action) setAction(nextAction);
            if (nextDir !== direction) setDirection(nextDir);

            if (onPositionChange) {
                const isStopping = nextAction === 'idle' && lastSentAction.current === 'walk';
                const intervalTrigger = state.clock.elapsedTime % 0.1 < delta;
                if (isStopping || (nextAction === 'walk' && intervalTrigger)) {
                    onPositionChange({ x: renderPos.current.x, z: renderPos.current.z, direction: nextDir, action: nextAction });
                    lastSentAction.current = nextAction;
                }
            }
        }

        lastRenderPos.current.copy(renderPos.current);

        if (!isRemote && controls) {
            // Smoothly move controls target to player
            // @ts-ignore
            controls.target.lerp(renderPos.current, 0.2);
            // Move camera to maintain calibrated offset [0, 100, 40]
            // @ts-ignore
            camera.position.copy(controls.target).add(new THREE.Vector3(0, 100, 40));
            // @ts-ignore
            controls.update();
        }

        const animBase = (direction === 'left' || direction === 'right') ? 'side' : direction;
        const currentKey = `${animBase}_${action}` as AnimKey;
        const config = ANIM_CONFIG[currentKey] || ANIM_CONFIG.down_idle;
        const fps = action === 'walk' ? 12 : 6;
        setFrameIndex(Math.floor(state.clock.elapsedTime * fps) % config.count);
    });

    const activeTexture = useMemo(() => {
        const animBase = (direction === 'left' || direction === 'right') ? 'side' : direction;
        const key = `${animBase}_${action}` as AnimKey;
        const startIdx = KEY_TO_START_IDX[key] ?? KEY_TO_START_IDX.down_idle;
        const count = ANIM_CONFIG[key]?.count ?? 1;
        return textures[startIdx + (frameIndex % count)];
    }, [direction, action, frameIndex, textures]);

    const labelStyle = useMemo(() => {
        if (!isRemote) return { color: isOwner ? '#FCD34D' : '#FFFFFF', text: ' (我)' };
        if (isOwner) return { color: '#FCD34D', text: ' (农场主)' };
        return { color: '#E3F0D1', text: ' (访客)' };
    }, [isRemote, isOwner]);

    return (
        <group position={[renderPos.current.x, 1.25, renderPos.current.z]}>
            <Html
                position={[0, 1.6, 0]}
                center
                pointerEvents="none"
                style={{ pointerEvents: 'none' }}
            >
                <div style={{
                    whiteSpace: 'nowrap',
                    fontFamily: '"VT323", "sans-serif"',
                    fontSize: '24px',
                    color: labelStyle.color,
                    textShadow: '2px 2px #000',
                    pointerEvents: 'none',
                    userSelect: 'none'
                }}>
                    {playerName}{labelStyle.text}
                </div>
            </Html>
            <Billboard>
                <mesh
                    ref={meshRef}
                    scale={[direction === 'right' ? -1.5 : 1.5, 1.5, 1]}
                    onPointerDown={(e) => {
                        e.stopPropagation = () => {};
                    }}
                    onPointerMove={(e) => {
                        e.stopPropagation = () => {};
                    }}
                    raycast={() => null}
                >
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial
                        map={activeTexture}
                        transparent
                        alphaTest={0.5}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            </Billboard>
            <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <circleGeometry args={[0.3, 16]} />
                <meshBasicMaterial color="black" transparent opacity={0.15} />
            </mesh>
        </group>
    );
});
