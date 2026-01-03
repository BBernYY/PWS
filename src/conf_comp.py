import math
import numpy as np
import trimesh
import os
width, height = 720, 720
MAX_BALLS = 8
MAX_FACES = 1024
MAX_MATS = 6
rpp = 1000
show_progress = True
length = 2*math.pi # seconds
time_fps = 24
render_fps = 1/12
# length = 0
start_time = 0
forever = False
supersample = False
hide_buildup = 100000000
pause = 0.001
lock_fps = False
focus_distance = 4.0
focus_strength = 0.000000001
exposure = 0.9
fp = "output.mp4"
# fp = "output.png"
seed = np.random.randint(0, 2**32)
import movement
movement.spd = 10
def get_cam(t):
    movement.update(1/time_fps)
    fov = 90
    return fov, movement.pos, movement.view
s = 1/6/(1024+4*2)
texcor = lambda i: [(i % 6)/6+4.5*s, (i // 6)/6+4.5*s, (i % 6)/6+1024*s+4.5*s, (i // 6)/6+1024*s+4.5*s]

def get_ballslist(t):
    t = t * 2
    objectlist = [
        # subject 1
        [
            [3, 1+math.sin(t), 3.0, 1.0],  # x, y, z, radius
            texcor(12)  # color (r,g,b,a)
        ],
        # subject 2
        [
            [1.0, 1.0+math.sin(t+2*math.pi*0.25), 3.0, 1.0],
            texcor(13)
        ],
        # subject 3
        [
            [-1.0, 1.0+math.sin(t+2*math.pi*0.5), 3.0, 1.0],
            texcor(14)
        ],
        # subject 4
        [
            [-3.0, 1.0+math.sin(t+2*math.pi*0.75), 3.0, 1.0],
            texcor(15)
        ],
        # sun
        [
            [0.0, 8.0, 3.0, 3.0],
            texcor(8)
        ],
        # ground
        [
            [0.0, -51.0, 0.0, 50.0],
            texcor(9)
        ],
        # skybox
        [
            [0.0, 0.0, 0.0, 1.0],
            [*texcor(10)[:2],*texcor(11)[2:]]
            # texcor(6)
        ]
    ]
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
def intpos(xy, tcor):
    return (tcor[0]*xy[0]+tcor[2]*(1-xy[0]), tcor[1]*xy[1]+tcor[3]*(1-xy[1]))
def get_facelist_v2(t):
    faces = 16*[0]
    bounds = [0]
    bindex = [0]
    return np.array(faces, dtype='f4').tobytes(), np.array(bounds, dtype='f4').flatten().tobytes(), np.array(bindex, dtype='int32').flatten().tobytes()
def get_facelist_mesh(obj, atlaspos):
    faces = np.array([])
    for i in obj.faces:
        face = np.array([])
        for j in i:
            face = np.append(face, [*obj.vertices[j], *intpos(obj.visual.uv[j], atlaspos)])
        faces = np.append(faces, face)
        faces = np.append(faces, 1)
    return faces
# def get_environment(t):
#     return np.array([0.6, 0.6, 0.9, 0.1-0.05*math.sin(t)], dtype='f4'), np.array([0.8, 0.8, 1.0, 0.4-0.1*math.sin(t)], dtype='f4'), np.array([0.5, 0.5, 0.5, 0.1-0.05*math.sin(t)], dtype='f4')
# def get_environment(t):
#     return np.zeros((3,4), dtype='f4')
