
MAX_BALLS = 128
width, height = 1920, 1080
rpp = 1000
show_progress = True
fps = 24
lock_fps = False
length = 0 # seconds
start_time = 3.14159
forever = False
fp = "output.png"
import math
import numpy as np
def get_objectlist(t):
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
    objects = np.array(objectlist, dtype='f4')
    pad_count = MAX_BALLS - objects.shape[0]
    pad_block = np.zeros((pad_count, 3, 4), dtype='f4')
    objects = np.vstack([objects, pad_block])
    return objects.tobytes()