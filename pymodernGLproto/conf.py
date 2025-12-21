import math
import numpy as np
import trimesh
import os
width, height = 720, 720
MAX_BALLS = 6
MAX_FACES = 2048
MAX_MATS = 6
rpp = 100
show_progress = True
fps = 24
length = math.pi*2 # seconds
start_time = 0
forever = False
supersample = False
hide_buildup = 1000000000000
pause = 0.0
lock_fps = False
focus_distance = 4.0
focus_strength = 0.00001
exposure = 1
fp = "output.mp4"
seed = np.random.randint(0, 2**32)
import movement
movement.spd = 10
def get_cam(t):
    movement.update(1/fps)
    fov = 90
    return fov, movement.pos, movement.view

texcor = lambda i: [1-1/3+(i % 2048)/3/2048+0.5/2048/3, 1-1/3+(i // 2048)/3/2048+0.5/2048/3, 1-1/3+(i % 2048)/3/2048+0.5/2048/3, 1-1/3+(i // 2048)/3/2048+0.5/2048/3]

def get_ballslist(t):
    t = t * 2
    objectlist = [
        # subject 1
        [
            [3, 1+math.sin(t), 3.0, 1.0],  # x, y, z, radius
            texcor(0)  # color (r,g,b,a)
        ],
        # subject 2
        [
            [1.0, 1.0+math.sin(t+2*math.pi*0.25), 3.0, 1.0],
            texcor(1)
        ],
        # subject 3
        [
            [-1.0, 1.0+math.sin(t+2*math.pi*0.5), 3.0, 1.0],
            texcor(2)
        ],
        # subject 4
        [
            [-3.0, 1.0+math.sin(t+2*math.pi*0.75), 3.0, 1.0],
            texcor(3)
        ],
        # sun
        [
            [0.0, 8.0, 3.0, 3.0],
            texcor(4)
        ],
        # ground
        [
            [0.0, -51.0, 0.0, 50.0],
            texcor(5)
        ]
    ]
    objectlist = [objectlist[0], objectlist[3], objectlist[4], objectlist[5]]
    objects = np.array(objectlist, dtype='f4')
    pad_count = MAX_BALLS - objects.shape[0]
    pad_block = np.zeros((pad_count, 2, 4), dtype='f4')
    objects = np.vstack([objects, pad_block], dtype='f4')
    return objects.flatten().tobytes()

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
def get_facelist_v2(t):
    nu = mesh.copy()
    nu.apply_transform(trimesh.transformations.rotation_matrix(t+0.5*math.pi, [1, 0, 0]))
    nu.apply_transform(trimesh.transformations.rotation_matrix(t, [0, 1, 0]))
    nu.apply_translation((0, 0, 2));
    objs = [nu]
    faces = []
    for i in objs:
        faces.append(get_facelist_mesh(i))
    return np.array([faces], dtype='f4').flatten().tobytes()
def get_facelist_mesh(obj):
    faces = np.array([])
    for i in obj.faces:
        face = np.array([])
        for j in i:
            face = np.append(face, [*obj.vertices[j], *obj.visual.uv[j]])
        faces = np.append(faces, face)
        faces = np.append(faces, 1)
    return faces
def get_environment(t):
    return np.array([0.6, 0.6, 0.9, 0.2-0.1*math.sin(t)], dtype='f4'), np.array([0.8, 0.8, 1.0, 0.5-0.2*math.sin(t)], dtype='f4'), np.array([0.2, 0.2, 0.2, 0.5-0.5*math.sin(t)], dtype='f4')
# def get_environment(t):
#     return np.zeros((3,4), dtype='f4')