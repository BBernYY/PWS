import math
import numpy as np
import trimesh
import os
width, height = 720, 720
MAX_BALLS = 16
MAX_FACES = 2048
MAX_MATS = 6
rpp = 10
show_progress = True
fps = 24
lock_fps = False
length = math.pi*1 # seconds
start_time = 0
forever = True
supersample = True
fp = "output.mp4"
seed = np.random.randint(0, 2**32)
def get_cam(t):
    pos = np.array([0, 1, -1], dtype='f4')
    direction = np.array([math.sin(0.2*0), 0, math.cos(0.2*0)], dtype='f4')
    up = np.array([0, 1, 0], dtype='f4')
    fov = 90
    return fov, pos, direction, up

def get_ballslist(t):
    t = t * 2
    objectlist = [
        # subject 1
        [
            [3.0, 1.0+math.sin(t), 3.0, 1.0],  # x, y, z, radius
            [0.9, 0.9, 0.8, 0.0],  # color (r,g,b), emission
            [0.01, 0.0, 0.0, 0.0],  # smoothness, padding...
        ],
        # subject 2
        [
            [1.0, 1.0+math.sin(t+math.pi*0.25), 3.0, 1.0],
            [0.9, 0.3, 0.2, 0.0],
            [0.01, 0.0, 0.0, 0.0],
        ],
        # subject 3
        [
            [-1.0, 1.0+math.sin(t+math.pi*0.5), 3.0, 1.0],
            [0.4, 0.9, 0.3, 0.0],
            [0.5, 0.0, 0.0, 0.0],
        ],
        # subject 4
        [
            [-3.0, 1.0+math.sin(t+math.pi*0.75), 3.0, 1.0],
            [0.2, 0.5, 0.9, 0.0],
            [1.0, 0.0, 0.0, 0.0],
        ],
        # sun
        [
            [0.0, 9.0, 1.0, 5.0],
            [1.0, 0.9, 0.8, 1.0],
            [1.0, 0.0, 0.0, 0.0],
        ],
        # ground
        [
            [0.0, -51.0, 0.0, 50.0],
            [0.6, 0.5, 0.5, 0.0],
            [0.5, 0.0, 0.0, 0.0],
        ]
    ]
    objectlist = [objectlist[0], objectlist[3], objectlist[4], objectlist[5]]
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
    # mesh = trimesh.creation.torus(1, 0.5, 12, 6)
    nu = mesh.copy()
    nu.apply_transform(trimesh.transformations.rotation_matrix(t, [1, 0, 0]))
    nu.apply_transform(trimesh.transformations.rotation_matrix(t+0.5*math.pi, [0, 1, 0]))
    nu.apply_translation((0, 0, 2));
    arr = add_mat(nu.vertices[mesh.faces], 2)
    facies = np.zeros((MAX_FACES,3,4), dtype='f4')
    facies[0:arr.shape[0]] = arr
    # cube2 = trimesh.load("objects/cube.obj", process=False)
    return facies.flatten().tobytes()
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
get_facelist(0)