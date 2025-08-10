import math
import os
import sys
import time
import numpy
import moderngl
import pygame
import random

os.environ['SDL_WINDOWS_DPI_AWARENESS'] = 'permonitorv2'

WIDTH, HEIGHT = 720, 720

pygame.init()
pygame.display.set_mode((WIDTH, HEIGHT), flags=pygame.OPENGL | pygame.DOUBLEBUF, vsync=False)

frame_index = 0

class Scene:
    def __init__(self):
        self.ctx = moderngl.get_context()

        prog = self.ctx.program(
            vertex_shader=open("shader.vert").read(),
            fragment_shader=open("shader.frag").read(),
        )

        self.vao = self.ctx.vertex_array(prog, [])
        self.vao.vertices = 6  # 6 vertices for 2 triangles forming the quad
        self.start_time = time.time()
        self.program = prog
    def render(self):
        self.ctx.clear()
        self.program['frameIndex'].value = frame_index
        #self.program['wsize'].value = [WIDTH, HEIGHT]
        self.program['t'].value = (time.time() - self.start_time)*0.1
        self.vao.render()


scene = Scene()
while True:
    frame_index += 1
    print(frame_index, scene.program['t'].value)
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()

    scene.render()

    pygame.display.flip()
