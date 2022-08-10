#define NULL 0

typedef unsigned int uint32_t;

typedef struct {
    short x;
    short y;
} point;

const point cell_size = { 100, 100 };
const point padding = { 12, 12 };
const point margin = { 0, 0 };

#define MAX_WIDTH 254
#define MAX_HEIGHT 254

#define WALL_COLOR "#000000"
#define WALK_COLOR "#0000ff"
#define SOLUTION_COLOR "#ff0000"
#define BACKGROUND_COLOR "#ffffff"

#define ANIMATION_DELAY 0.0035

#define PASSAGE   0
#define WALL      1
#define UNVISITED 2
#define SOLUTION  3

#define NORTH {  0, -1 }
#define EAST  { -1, 0  }
#define SOUTH {  0, 1  }
#define WEST  {  1, 0  }

static inline unsigned short points_eql(const point *a, const point *b)
{
    return (a && b && a->x == b->x && a->y == b->y);
}

static uint32_t rand_state[4];

static inline uint32_t rotl(const uint32_t x, int k)
{
	return (x << k) | (x >> (32 - k));
}

static inline uint32_t splitmix32(uint32_t *in)
{
    uint32_t z = (*in += 0x9e3779b9);
    z = (z ^ (z >> 16)) * 0x85ebca6b;
    z = (z ^ (z >> 13)) * 0xc2b2ae35;
    return z ^ (z >> 16);
}

static void rand_seed(uint32_t seed)
{
    uint32_t mixer = seed;

    /* Populate the random state based on the seed using splitmix32 */
    rand_state[0] = splitmix32(&mixer);
    rand_state[1] = splitmix32(&mixer);
    rand_state[2] = splitmix32(&mixer);
    rand_state[3] = splitmix32(&mixer);
}

static uint32_t rand_next(void)
{
    /*
     * This is xoshiro128**, a 32-bit PRNG by David Blackman and
     * Sebastiano Vigna. We use this for consistency of generation
     * across implementations.
     */
	const uint32_t result = rotl(rand_state[1] * 5, 7) * 9;
	const uint32_t t = rand_state[1] << 9;

	rand_state[2] ^= rand_state[0];
	rand_state[3] ^= rand_state[1];
	rand_state[1] ^= rand_state[2];
	rand_state[0] ^= rand_state[3];

	rand_state[2] ^= t;

	rand_state[3] = rotl(rand_state[3], 11);

	return result;
}

static void randomize_directions(point directions[4])
{
    unsigned short i, j;
    point temp;

    for (i = 3; i > 0; i--) {
        j = rand_next() % (i + 1);

        temp.x = directions[i].x;
        temp.y = directions[i].y;
        directions[i].x = directions[j].x;
        directions[i].y = directions[j].y;
        directions[j].x = temp.x;
        directions[j].y = temp.y;
    }
}

static void generate_maze(
    unsigned char maze[MAX_HEIGHT][MAX_WIDTH],
    point *size,
    point *start,
    point *end)
{
    unsigned short x, y;
    unsigned short remain = (size->x / 2) * (size->y / 2);
    unsigned short i;
    point p;

    for (x = 0; x < size->x; x++) {
        for (y = 0; y < size->y; y++) {
            maze[y][x] = WALL;
        }
    }

    /* set up the start and end nodes */
    start->x = 1 + (rand_next() % (size->x / 2)) * 2;
    start->y = 0;
    maze[start->y][start->x] = PASSAGE;

    end->x = 1 + (rand_next() % (size->x / 2)) * 2;
    end->y = size->y - 1;
    maze[end->y][end->x] = PASSAGE;

    /* set up the walk with unvisited passages */
    for (x = 1; x < size->x; x += 2) {
        for (y = 1; y < size->y; y += 2) {
            maze[y][x] = UNVISITED;
        }
    }

    /* select a random unvisited passage to start */
    p.x = 1 + (rand_next() % (size->x / 2)) * 2;
    p.y = 1 + (rand_next() % (size->y / 2)) * 2;

    maze[p.y][p.x] = 0;
    remain--;

    /*
     * Aldous-Broder algorithm: walk through the maze in random
     * directions, removing the wall to the neighbor if we haven't
     * yet seen it
     */
    while (remain > 0) {
        point directions[] = { NORTH, EAST, SOUTH, WEST };
        randomize_directions(directions);

        for (i = 0; i < 4; i++) {
            point wall = {
                p.x + directions[i].x,
                p.y + directions[i].y
            };
            point neighbor = {
                p.x + (directions[i].x * 2),
                p.y + (directions[i].y * 2)
            };

            /* stop if we're walking outside the bounds of the maze */
            if (wall.x < 1 || wall.x > (size->x - 2) ||
                wall.y < 1 || wall.y > (size->y - 2)) {
                continue;
            }

            /* remove the wall, mark the neighbor as seen */
            if (maze[neighbor.y][neighbor.x] == UNVISITED) {
                maze[neighbor.y][neighbor.x] = PASSAGE;
                maze[wall.y][wall.x] = PASSAGE;
                remain--;
            }

            p.x = neighbor.x;
            p.y = neighbor.y;
            break;
        }
    }
}

extern void render_move_in(unsigned short x, unsigned short y);
extern void render_move_out(unsigned short x, unsigned short y);
extern void render_solution(unsigned short x, unsigned short y);

static unsigned char solve_maze(
    unsigned char maze[MAX_HEIGHT][MAX_WIDTH],
    const point *size,
    const point *current,
    const point *previous,
    const point *end)
{
    if (maze[current->y][current->x] == WALL) {
        return 0;
    }

    render_move_in(current->x, current->y);

    if (current->x == end->x && current->y == end->y) {
        maze[current->y][current->x] = SOLUTION;
        render_solution(current->x, current->y);
        return 1;
    }

    if (current->y > 0) {
        point north = { current->x, current->y - 1 };

        if (!points_eql(&north, previous) &&
            solve_maze(maze, size, &north, current, end)) {
            maze[current->y][current->x] = SOLUTION;
            render_solution(current->x, current->y);
            return 1;
        }
    }

    if (current->x > 0) {
        point east = { current->x - 1, current->y };

        if (!points_eql(&east, previous) &&
            solve_maze(maze, size, &east, current, end)) {
            maze[current->y][current->x] = SOLUTION;
            render_solution(current->x, current->y);
            return 1;
        }
    }

    if (current->y < (size->y - 1)) {
        point south = { current->x, current->y + 1 };

        if (!points_eql(&south, previous) &&
            solve_maze(maze, size, &south, current, end)) {
            maze[current->y][current->x] = SOLUTION;
            render_solution(current->x, current->y);
            return 1;
        }
    }

    if (current->x < (size->x - 1)) {
        point west = { current->x + 1, current->y };

        if (!points_eql(&west, previous) &&
            solve_maze(maze, size, &west, current, end)) {
            maze[current->y][current->x] = SOLUTION;
            render_solution(current->x, current->y);
            return 1;
        }
    }

    render_move_out(current->x, current->y);

    return 0;
}

extern void render_maze_cell(
    unsigned short x,
    unsigned short y,
    unsigned char type);

static void render_maze(
    unsigned char maze[MAX_HEIGHT][MAX_WIDTH], 
    point *size)
{
    unsigned short x, y;

    for (y = 0; y < size->y; y++) {
        for (x = 0; x < size->x; x++) {
            render_maze_cell(x, y, maze[y][x]);
        }
    }
}

//const char * EMSCRIPTEN_KEEPALIVE maze(uint32_t seed)
__attribute__((used)) int generate_and_solve_maze(
    int width,
    int height,
    int seed)
{
    unsigned char maze[MAX_HEIGHT][MAX_WIDTH];
    point size = { width, height }, start, end;

    rand_seed(seed);

    generate_maze(maze, &size, &start, &end);
    render_maze(maze, &size);

    solve_maze(maze, &size, &start, NULL, &end);

    /*


    const point total = {
        margin.x * 2 + cell_size.x * size.x,
        margin.y * 2 + cell_size.y * size.y
    };

    generate_maze(maze, &size, &start, &end);

    start_svg(total.x / 30, total.y / 30, total.x, total.y);
    show_maze(maze, &size);

    start_maze(maze, &size);
    solve(maze, &size, &start, NULL, &end);
    end_maze();



    end_svg();
    */

    return 42;

//    return "hello, world.";
}
