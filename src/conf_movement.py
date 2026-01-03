import math
import numpy as np
import trimesh
import os
width, height = 1920, 1080
MAX_BALLS = 6
MAX_FACES = 1024
MAX_MATS = 6
rpp = 20
show_progress = True
length = 5 # seconds
time_fps = 12
render_fps = 1/12
# length = 0
start_time = 3.5
forever = False
supersample = False
hide_buildup = 100000000
pause = 0.001
lock_fps = False
focus_distance = 2.0
focus_strength = 0.000000001
exposure = 0.6
# fp = "output.mp4"
fp = "output.png"
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
            texcor(5)  # color (r,g,b,a)
        ],
        # subject 2
        [
            [1.0, 1.0+math.sin(t+2*math.pi*0.25), 3.0, 1.0],
            texcor(5)
        ],
        # subject 3
        [
            [-1.0, 1.0+math.sin(t+2*math.pi*0.5), 3.0, 1.0],
            texcor(6)
        ],
        # subject 4
        [
            [-3.0, 1.0+math.sin(t+2*math.pi*0.75), 3.0, 1.0],
            texcor(7)
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
    objectlist = [objectlist[0], objectlist[3], objectlist[4], objectlist[5], objectlist[-1]]
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
# mesh.apply_scale(0.5)
mesh2 = trimesh.load("objects/torus_576.obj")
def intpos(xy, tcor):
    return (tcor[0]*xy[0]+tcor[2]*(1-xy[0]), tcor[1]*xy[1]+tcor[3]*(1-xy[1]))
def get_facelist_v2(t):
    nu = mesh.copy()
    nu.apply_transform(trimesh.transformations.rotation_matrix(t+0.5*math.pi, [1, 0, 0]))
    nu.apply_transform(trimesh.transformations.rotation_matrix(t, [0, 1, 0]))
    nu.apply_translation((0, 0, 2))
    nu2 = mesh2.copy()
    nu2.apply_transform(trimesh.transformations.rotation_matrix(t, [1, 0, 0]))
    nu2.apply_transform(trimesh.transformations.rotation_matrix(t+0.5*math.pi, [0, 1, 0]))
    nu2.apply_translation((0, 2, 2))
    objs = [nu]
    faces = []
    bounds = []
    bindex = []
    for i in range(len(objs)):
        dat = get_facelist_mesh(objs[i], texcor(0))
        start = len(faces)//16
        end = start+len(dat)//16
        faces.extend(dat)
        bbverts = objs[i].bounding_box.vertices
        bounds.append([*objs[i].bounds[0], 0, *objs[i].bounds[1], 0])
        bindex.extend([[i, ind] for ind in range(start,end)])
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
