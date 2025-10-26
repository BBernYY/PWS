import threading
import numpy as np
import readchar
k = readchar.key
inputs = np.zeros(10, dtype='f4')
lock = threading.Lock()
running = True
keybinds = ["w", "a", "s", "d", "e", "q", k.UP, k.LEFT, k.DOWN, k.RIGHT]
def input_thread():
    global inputs
    while True:
        inpy = readchar.readkey()
        with lock:
            if k.CTRL_C in inpy:
                running = False
                break
            inputs = [keybinds[i] in inpy for i in range(10)]
thread = threading.Thread(target=input_thread, daemon=True)
thread.start()
pos = np.array([0, 1, 0], dtype='f4')
view_init = np.identity(3, dtype='f4')
spd = 1
speeds = np.array([1, 1, 1, 1, 1, 1, 25, 25, 25, 25], dtype='f4')*spd
rotate_x = lambda theta: np.array([
    [1, 0, 0],
    [0, np.cos(theta), -np.sin(theta)],
    [0, np.sin(theta),  np.cos(theta)]
])
rotate_y = lambda theta: np.array([
    [ np.cos(theta), 0, np.sin(theta)],
    [ 0, 1, 0],
    [-np.sin(theta), 0, np.cos(theta)]
])
phi, theta = 0, 0
def update(dt):
    if not running:
        raise KeyboardInterrupt
    dt *= spd
    global pos
    global inputs
    global view
    global phi, theta
    inp = inputs.copy()
    phi += np.deg2rad(inp[6]*speeds[6]*dt)
    theta += np.deg2rad(inp[7]*speeds[7]*dt)
    phi -= np.deg2rad(inp[8]*speeds[9]*dt)
    theta -= np.deg2rad(inp[9]*speeds[9]*dt)
    view = rotate_x(phi)@rotate_y(theta)@view_init
    pos += np.array([0,0,1])@view*inp[0]*speeds[0]*dt
    pos += np.array([-1,0,0])@view*inp[1]*speeds[1]*dt
    pos += np.array([0,0,-1])@view*inp[2]**speeds[2]*dt
    pos += np.array([1,0,0])@view*inp[3]*speeds[3]*dt
    pos[1] += inp[4]*speeds[4]*dt
    pos[1] -= inp[5]*speeds[5]*dt
    with lock:
        inputs = np.zeros(10, dtype='f4')