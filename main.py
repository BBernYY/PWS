import moderngl
import pyglet
from pyglet import gl
import numpy as np


window = pyglet.window.Window(720, 720, "UV-mapped Quad", resizable=False)
ctx = moderngl.create_context()

vertices = np.array([
    -1, -1, 0, 0,  # 0: bottom-left
     1, -1, 1, 0,  # 1: bottom-right
    -1,  1, 0, 1,  # 2: top-left
     1,  1, 1, 1,  # 3: top-right
], dtype='f4')

# Indices for two triangles
indices = np.array([0, 1, 2, 2, 1, 3], dtype='i4')

vbo = ctx.buffer(vertices.tobytes())
ibo = ctx.buffer(indices.tobytes())

prog = ctx.program(
    vertex_shader=open('shaders/main.vert').read(),
    fragment_shader=open('shaders/main.frag').read()
)

vao = ctx.vertex_array(
    prog,
    [(vbo, '2f 2f', 'in_position', 'in_uv')],
    index_buffer=ibo
)

@window.event
def on_draw():
    vao.render()

if __name__ == '__main__':
    pyglet.app.run()