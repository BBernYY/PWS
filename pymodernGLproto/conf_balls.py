import math
import numpy as np
import trimesh
import os
width, height = 720, 720
MAX_BALLS = 16
MAX_FACES = 2048
MAX_MATS = 6
rpp = 100
show_progress = True
fps = 24
lock_fps = False
length = math.pi*1 # seconds
start_time = 0
forever = True
supersample = False
hide_buildup = True
exposure = 0.9
focus_distance = 4
focus_strength = 0.001
pause = 0
fp = "output.mp4"
seed = np.random.randint(0, 2**32)
import movement
movement.update(0)
mpos, mview = movement.pos, movement.view
movement.pos = np.array([3.0, 2.0, 3.0])
def get_cam(t):
    fov = 90
    movement.update(1/fps)
    return fov, mpos, mview

def get_ballslist(t):
    t = t * 2
    objectlist = [
        # subject 1
        [
            # [3*math.cos(0.2*t), 2.0-2*math.cos(0.2*t), 3+2*math.sin(0.2*t), 0.5],  # x, y, z, radius
            [*movement.pos, 0.5],
            [0.2, 0.2, 0.2, 100],  # color (r,g,b), emission
            [0.2, 0.2, 0.2, 1.0],  # smoothness, padding...
        ],
        # subject 2
        [
            [1.0, 1.0+math.sin(t+math.pi*0.25), 3.0, 1.0],
            [0.9, 0.4, 0.3, 0.0],
            [0.9, 0.4, 0.3, 0.5],
        ],
        # subject 3
        [
            [-1.0, 1.0+math.sin(t+math.pi*0.5), 3.0, 1.0],
            [0.3, 0.9, 0.4, 0.0],
            [0.3, 0.9, 0.4, 0.3],
        ],
        # subject 4
        [
            [-3.0, 1.0+math.sin(t+math.pi*0.75), 3.0, 1.0],
            [0.4, 0.3, 0.9, 0.0],
            [0.4, 0.3, 0.9, 0.1],
        ],
        # sun
        [
            [0.0, 90.0, 3.0, 50.0],
            [1.0, 0.9, 0.8, 2],
            [1.0, 0.9, 0.8, 1.0],
        ],
        # ground
        [
            [0.0, -51.0, 0.0, 50.0],
            [0.6, 0.6, 0.6, 0.0],
            [0.4, 0.4, 0.4, 0.2],
        ]
    ]
    # objectlist = [objectlist[0], objectlist[3], objectlist[4], objectlist[5]]
    objects = np.array(objectlist, dtype='f4')
    pad_count = MAX_BALLS - objects.shape[0]
    pad_block = np.zeros((pad_count, 3, 4), dtype='f4')
    objects = np.vstack([objects, pad_block], dtype='f4')
    return objects.tobytes()

def get_random(arr, seed=0):
    np.random.seed(seed)
    possies = {}
    B = []
    for i in arr:
        D = [0, 0, 0]
        for j in range(3):
            g = str(i[j])
            if g in possies:
                D[j] = (possies[g])
                continue
            else:
                possies[g] = np.random.randint(1, 3)
                D[j] = possies[g]
                B.append(D)
    return B
    C = np.zeros((arr.shape[0],3,4), dtype='f4')
def add_mat(arr, id):
    C = np.zeros((arr.shape[0],3,4), dtype='f4')
    B = np.full((arr.shape[0],3), float(id), dtype='f4')
    C[:,:,:3] = arr
    C[:,:,3] = B
    return C
mesh = trimesh.load("objects/cube.obj")
B = get_random(mesh.vertices[mesh.faces], seed=seed)
def get_facelist(t): # vreselijke implementatie maar geen bottleneck
    return np.array([0., 0., 0.], dtype='f4').flatten().tobytes()
def get_matlist(t):
    matlist = [
        # sun
        [
            [1.0, 0.9, 0.8, 1.0],
            [1.0, 0.0, 0.0, 0.0],
        ],
        # subject 1
        [
            [0.9, 0.9, 0.8, 0.0],  # color (r,g,b), emission
            [0.01, 0.0, 0.0, 0.0],  # smoothness, padding...
        ],
        # subject 2
        [
            [0.9, 0.3, 0.2, 0.0],
            [0.01, 0.0, 0.0, 0.0],
        ],
        # subject 3
        [
            [0.4, 0.9, 0.3, 0.0],
            [0.5, 0.0, 0.0, 0.0],
        ],
        # subject 4
        [
            [0.2, 0.5, 0.9, 0.0],
            [1.0, 0.0, 0.0, 0.0],
        ],

        # ground
        [
            [0.6, 0.5, 0.5, 0.0],
            [0.5, 0.0, 0.0, 0.0],
        ]
    ]
    mats = np.array(matlist, dtype='f4')
    pad_count = MAX_MATS - mats.shape[0]
    pad_block = np.zeros((pad_count, 2, 4), dtype='f4')
    mats = np.vstack([mats, pad_block])
    return mats.flatten().tobytes()
def get_environment(t):
    return np.array([0.2, 0.2, 0.9, 2-2*math.sin(t)], dtype='f4'), np.array([0.8, 0.8, 1.0, 3-3*math.sin(t)], dtype='f4'), np.array([0.2, 0.2, 0.2, 0.5-0.5*math.sin(t)], dtype='f4')