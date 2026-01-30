
import { Plot, MAP_COLS, MAP_ROWS } from '../types';

interface Point { x: number; y: number; }

const heuristic = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
};

// 视线检查：判断两点间是否有障碍物（水、木、石）
const isWalkableLine = (p1: Point, p2: Point, plots: Plot[]) => {
    let x0 = p1.x, y0 = p1.y;
    const x1 = p2.x, y1 = p2.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        const idx = y0 * MAP_COLS + x0;
        const p = plots[idx];
        if (p && ['wood', 'stone', 'water'].includes(p.type)) return false;

        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return true;
};

// 简化路径：尝试将多个格点合并为长直线
const simplifyPath = (path: Point[], plots: Plot[]) => {
    if (path.length <= 2) return path;
    const simplified: Point[] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
        let bestVisible = current + 1;
        // 尝试探测最远可直线到达的点
        for (let i = current + 2; i < path.length; i++) {
            if (isWalkableLine(path[current], path[i], plots)) {
                bestVisible = i;
            } else {
                break;
            }
        }
        simplified.push(path[bestVisible]);
        current = bestVisible;
    }
    return simplified;
};

export const findPath = (start: Point, end: Point, plots: Plot[]): Point[] | null => {
    if (end.x < 0 || end.x >= MAP_COLS || end.y < 0 || end.y >= MAP_ROWS) return null;

    const size = MAP_COLS * MAP_ROWS;
    const startIdx = start.y * MAP_COLS + start.x;
    const endIdx = end.y * MAP_COLS + end.x;

    const isWalkable = (idx: number) => {
        if (idx < 0 || idx >= size) return false;
        const p = plots[idx];
        return p && !['wood', 'stone', 'water'].includes(p.type);
    };

    if (!isWalkable(endIdx)) return null;
    if (startIdx === endIdx) return [start];

    const gScore = new Float32Array(size).fill(Infinity);
    const fScore = new Float32Array(size).fill(Infinity);
    const cameFrom = new Int32Array(size).fill(-1);

    gScore[startIdx] = 0;
    fScore[startIdx] = heuristic(start.x, start.y, end.x, end.y);

    const openSet: number[] = [startIdx];

    while (openSet.length > 0) {
        let currentIdx = openSet[0];
        let minF = fScore[currentIdx];
        let bestIdx = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (fScore[openSet[i]] < minF) {
                minF = fScore[openSet[i]];
                currentIdx = openSet[i];
                bestIdx = i;
            }
        }

        if (currentIdx === endIdx) {
            const rawPath: Point[] = [];
            let curr = currentIdx;
            while (curr !== -1) {
                rawPath.push({ x: curr % MAP_COLS, y: Math.floor(curr / MAP_COLS) });
                curr = cameFrom[curr];
            }
            return simplifyPath(rawPath.reverse(), plots);
        }

        openSet.splice(bestIdx, 1);
        const cx = currentIdx % MAP_COLS;
        const cy = Math.floor(currentIdx / MAP_COLS);

        const neighbors = [
            cy > 0 ? currentIdx - MAP_COLS : -1,
            cy < MAP_ROWS - 1 ? currentIdx + MAP_COLS : -1,
            cx > 0 ? currentIdx - 1 : -1,
            cx < MAP_COLS - 1 ? currentIdx + 1 : -1
        ];

        for (const neighborIdx of neighbors) {
            if (neighborIdx === -1 || !isWalkable(neighborIdx)) continue;
            const tentativeGScore = gScore[currentIdx] + 1;
            if (tentativeGScore < gScore[neighborIdx]) {
                cameFrom[neighborIdx] = currentIdx;
                gScore[neighborIdx] = tentativeGScore;
                fScore[neighborIdx] = tentativeGScore + heuristic(
                    neighborIdx % MAP_COLS, Math.floor(neighborIdx / MAP_COLS),
                    end.x, end.y
                );
                if (!openSet.includes(neighborIdx)) openSet.push(neighborIdx);
            }
        }
    }
    return null;
};
