import type { NextRequest } from 'next/server'
import { useRouter } from 'next/router'

const IMAGE_SIZE: Point = { x: 300, y: 300 };
const MAZE_SIZE: Point = { x: 127, y: 127 };

const CELL_SIZE: Point = { x: 100, y: 100 };
const PADDING: Point = { x: 12, y: 12 };
const MARGIN: Point = { x: 0, y: 0 };

const WALL_COLOR: string = "#000000";
const WALK_COLOR: string = "#0000ff";
const SOLUTION_COLOR: string = "#ff0000";
const BACKGROUND_COLOR: string = "#ffffff";

const ANIMATION_DELAY: number = 0.0035;

interface Point {
    x: number,
    y: number
}

interface Animation {
    tick: number,
    svg: string[]
}

enum Type {
    Passage,
    Wall,
    Unvisited,
    Solution
}

class Direction {
    static readonly North = { x: 0,  y: -1 };
    static readonly East  = { x: -1, y: 0  };
    static readonly South = { x:  0, y: 1  };
    static readonly West  = { x:  1, y: 0  };
}

export const config = {
  runtime: 'experimental-edge',
}

let randomState: number[] = [ 0, 0, 0, 0 ];

function rotl(x: number, k: number) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function splitmix32(n: number): [ number, number ] {
    let z = n = ((n >>> 0) + 0x9e3779b9) >>> 0;
    z = Math.imul((z ^ (z >>> 16)) >>> 0, 0x85ebca6b) >>> 0;
    z = Math.imul((z ^ (z >>> 13)) >>> 0, 0xc2b2ae35) >>> 0;
    return [ n, (z ^ (z >>> 16)) >>> 0 ];
}
 
 function randSeed(seed: number) {
    let mixer: number = seed;

    // Populate the random state based on the seed using splitmix32
    [ mixer, randomState[0] ] = splitmix32(mixer);
    [ mixer, randomState[1] ] = splitmix32(mixer);
    [ mixer, randomState[2] ] = splitmix32(mixer);
    [ mixer, randomState[3] ] = splitmix32(mixer);
}

function randNext(): number {
    // This is xoshiro128**, a 32-bit PRNG by David Blackman and
    // Sebastiano Vigna. We use this for consistency of generation
    // across implementations.
    let result: number = Math.imul(rotl(Math.imul(randomState[1], 5) >>> 0, 7), 9) >>> 0;
    const t: number = randomState[1] << 9;

    randomState[2] ^= randomState[0];
    randomState[3] ^= randomState[1];
    randomState[1] ^= randomState[2];
    randomState[0] ^= randomState[3];

    randomState[2] ^= t;

    randomState[3] = rotl(randomState[3], 11);

    result = result >>> 0;

    return result;
}

function randomizeDirections(directions: Direction[])
{
    for (let i = directions.length - 1; i > 0; i--) {
        const j = randNext() % (i + 1);
        [ directions[i], directions[j] ] = [ directions[j], directions[i] ]
    }
}

function generateMaze(): [ Type[][], Point, Point ]
{
    let maze: Type[][] = [ ];
    let unvisited = Math.floor(MAZE_SIZE.x / 2) * Math.floor(MAZE_SIZE.y / 2);

    for (let y = 0; y < MAZE_SIZE.y; y++) {
        maze[y] = new Array();

        for (let x = 0; x < MAZE_SIZE.x; x++) {
            maze[y][x] = Type.Wall;
        }
    }

    // set up the start and end nodes 
    let start: Point = {
        x: 1 + (randNext() % Math.floor(MAZE_SIZE.x / 2)) * 2,
        y: 0
    };
    maze[start.y][start.x] = Type.Passage;

    let end: Point = {
        x: 1 + (randNext() % Math.floor(MAZE_SIZE.x / 2)) * 2,
        y: MAZE_SIZE.y - 1
    };
    maze[end.y][end.x] = Type.Passage;

    // set up the walk with unvisited passages
    for (let x = 1; x < MAZE_SIZE.x; x += 2) {
        for (let y = 1; y < MAZE_SIZE.y; y += 2) {
            maze[y][x] = Type.Unvisited;
        }
    }

    // select a random unvisited passage to start
    let p: Point = {
        x: 1 + (randNext() % Math.floor(MAZE_SIZE.x / 2)) * 2,
        y: 1 + (randNext() % Math.floor(MAZE_SIZE.y / 2)) * 2
    };

    maze[p.y][p.x] = Type.Passage;
    unvisited--;

    // Aldous-Broder algorithm: walk through the maze in random
    // directions, removing the wall to the neighbor if we haven't
    // yet seen it
    while (unvisited > 0) {
        let directions: Point[] = [
            Direction.North,
            Direction.East,
            Direction.South,
            Direction.West
        ];

        randomizeDirections(directions);

        for (let i = 0; i < directions.length; i++) {
            let wall: Point = {
                x: p.x + directions[i].x,
                y: p.y + directions[i].y
            };
            let neighbor: Point = {
                x: p.x + (directions[i].x * 2),
                y: p.y + (directions[i].y * 2)
            };

            // stop if we're walking outside the bounds of the maze
            if (wall.x < 1 || wall.x > (MAZE_SIZE.x - 2) ||
                wall.y < 1 || wall.y > (MAZE_SIZE.y - 2)) {
                continue;
            }

            // remove the wall, mark the neighbor as seen
            if (maze[neighbor.y][neighbor.x] == Type.Unvisited) {
                maze[neighbor.y][neighbor.x] = Type.Passage;
                maze[wall.y][wall.x] = Type.Passage;
                unvisited--;
            }

            p.x = neighbor.x;
            p.y = neighbor.y;
            break;
        }
    }

    return [ maze, start, end ];
}



function renderMoveIn(x: number, y: number, animation: Animation) {
    animation.svg.push(`<animate xlink:href="#${x}_${y}" attributeName="fill" from="${BACKGROUND_COLOR}" to="${WALK_COLOR}" dur="${ANIMATION_DELAY}s" begin="${animation.tick}s" fill="freeze"/>`);
    animation.tick += ANIMATION_DELAY;
}

function renderMoveOut(x: number, y: number, animation: Animation) {
    animation.svg.push(`<animate xlink:href="#${x}_${y}" attributeName="fill" from="${WALK_COLOR}" to="${BACKGROUND_COLOR}" dur="${ANIMATION_DELAY}s" begin="${animation.tick}s" fill="freeze"/>`);
    animation.tick += ANIMATION_DELAY;
}

function renderSolution(x: number, y: number, animation: Animation) {
    animation.svg.push(`<animate xlink:href="#${x}_${y}" attributeName="fill" from="${WALK_COLOR}" to="${SOLUTION_COLOR}" dur="${ANIMATION_DELAY}s" begin="${animation.tick}s" fill="freeze"/>`);
    animation.tick += ANIMATION_DELAY;
}

function pointsEqual(a: Point | undefined, b: Point | undefined) {
    return (a && b && a.x == b.x && a.y == b.y);
}

function solveRecursive(maze: Type[][], current: Point, previous: Point | undefined, end: Point, animation: Animation): boolean {
    if (maze[current.y][current.x] == Type.Wall) {
        return false;
    }

    renderMoveIn(current.x, current.y, animation);

    if (current.x == end.x && current.y == end.y) {
        maze[current.y][current.x] = Type.Solution;
        renderSolution(current.x, current.y, animation);
        return true;
    }

    if (current.y > 0) {
        const north: Point = { x: current.x, y: current.y - 1 };

        if (!pointsEqual(north, previous) &&
            solveRecursive(maze, north, current, end, animation)) {
            maze[current.y][current.x] = Type.Solution;
            renderSolution(current.x, current.y, animation);
            return true;
        }
    }

    if (current.x > 0) {
        const east: Point = { x: current.x - 1, y: current.y };

        if (!pointsEqual(east, previous) &&
            solveRecursive(maze, east, current, end, animation)) {
            maze[current.y][current.x] = Type.Solution;
            renderSolution(current.x, current.y, animation);
            return true;
        }
    }

    if (current.y < (MAZE_SIZE.y - 1)) {
        const south: Point = { x: current.x, y: current.y + 1 };

        if (!pointsEqual(south, previous) &&
            solveRecursive(maze, south, current, end, animation)) {
            maze[current.y][current.x] = Type.Solution;
            renderSolution(current.x, current.y, animation);
            return true;
        }
    }

    if (current.x < (MAZE_SIZE.x - 1)) {
        const west: Point = { x: current.x + 1, y: current.y };

        if (!pointsEqual(west, previous) &&
            solveRecursive(maze, west, current, end, animation)) {
            maze[current.y][current.x] = Type.Solution;
            renderSolution(current.x, current.y, animation);
            return true;
        }
    }

    renderMoveOut(current.x, current.y, animation);

    return false;
}

function solveMaze(maze: Type[][], start: Point, end: Point) {
    let animation = { tick: 0.0, svg: new Array() };

    solveRecursive(maze, start, undefined, end, animation);

    return animation.svg.join("\n");
}

function renderStart(): string {
    const total: Point = {
        x: MARGIN.x * 2 + CELL_SIZE.x * MAZE_SIZE.x,
        y: MARGIN.y * 2 + CELL_SIZE.y * MAZE_SIZE.y
    };

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
        `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n` +
        `<svg width="${IMAGE_SIZE.x}" height="${IMAGE_SIZE.y}" viewBox="0 0 ${total.x} ${total.y}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
        `<rect x="0" y="0" width="${total.x}" height="${total.y}" fill="${BACKGROUND_COLOR}" />`;
}

function renderMazeCell(x: number, y: number, cellType: Type): string {
    switch (cellType) {
        case Type.Passage:
            return `<rect id="${x}_${y}" x="${MARGIN.x + (CELL_SIZE.x * x) + PADDING.x}" y="${MARGIN.y + (CELL_SIZE.y * y) + PADDING.y}" width="${CELL_SIZE.x - (PADDING.x * 2)}" height="${CELL_SIZE.y - (PADDING.y * 2)}" fill="${BACKGROUND_COLOR}" />`;

        case Type.Wall:
            return `<rect x="${MARGIN.x + (CELL_SIZE.x * x)}" y="${MARGIN.y + (CELL_SIZE.y * y)}" width="${CELL_SIZE.x}" height="${CELL_SIZE.y}" fill="${WALL_COLOR}" />`;

        case Type.Solution:
            return `<rect id="${x}_${y}" x="${MARGIN.x + (CELL_SIZE.x * x) + PADDING.x}" y="${MARGIN.y + (CELL_SIZE.y * y) + PADDING.y}" width="${CELL_SIZE.x - (PADDING.x * 2)}" height="${CELL_SIZE.y - (PADDING.y * 2)}" fill="${SOLUTION_COLOR}" />`;
    }

    throw new Error("unknown maze tile type");
}

function renderMaze(maze: Type[][]): string {
    let svg: string[] = new Array();

    for (let y = 0; y < MAZE_SIZE.y; y++) {
        for (let x = 0; x < MAZE_SIZE.x; x++) {
            svg.push(renderMazeCell(x, y, maze[y][x]));
        }
    }

    return svg.join("\n");
}

function renderEnd() {
    return `</svg>`;
}

function renderAndSolveMaze() {
    let [ maze, start, end ] = generateMaze();
    const svgMaze = renderMaze(maze);
    const svgSolution = solveMaze(maze, start, end);

    return [ svgMaze, svgSolution ].join("\n");
}

export default function handler(req: NextRequest, event: Event): Response {
    const timeStart = new Date().getMilliseconds();

    const { searchParams } = new URL(req.url);
    const seed = searchParams.get('seed');

    if (seed) {
        randSeed(parseInt(seed, 16));
    } else {
        randSeed(Math.floor(Math.random() * 4294967295));
    }

    const svgHeader = renderStart();
    const svgMazeAndSolution = renderAndSolveMaze();
    const svgFooter = renderEnd();

    const svg = [ svgHeader, svgMazeAndSolution, svgFooter ].join("\n");

    const timeEnd = new Date().getMilliseconds();
    console.log(`JS: ${timeEnd - timeStart}ms`);

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml"
        }
    });
}
