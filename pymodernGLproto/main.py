import moderngl
import pygame
import numpy as np
import time
import imageio
from PIL import Image
import math
import copy

from conf import *

if show_progress:
    pygame.init()
    pygame.display.set_mode((width, height), pygame.OPENGL | pygame.DOUBLEBUF)
    ctx = moderngl.create_context()
else:
    ctx = moderngl.create_standalone_context()


ssbo = ctx.buffer(get_ballslist(start_time))
vertssbo = ctx.buffer(get_facelist(start_time))
vertssbo.bind_to_storage_buffer(binding=4)
matssbo = ctx.buffer(get_matlist(start_time))
matssbo.bind_to_storage_buffer(binding=3)
ssbo.bind_to_storage_buffer(binding=5)
print(open("tracer.frag", "r").read())
program = ctx.program(
    vertex_shader=open("fs_quad.vert", "r").read(),
    fragment_shader=open("tracer.frag", "r").read(),
)
init_time = time.time()
vao = ctx.vertex_array(program, [])
accumulator_program = ctx.program(
    vertex_shader=open("fs_quad.vert", "r").read(),
    fragment_shader=open("accumulator.frag", "r").read(),
)
tracer_tex = ctx.texture((width, height), 4)  # 4 = RGBA channels
fbo = ctx.framebuffer(tracer_tex)
accumulator_vao = ctx.vertex_array(accumulator_program, [])
ping = ctx.texture((width, height), 4, dtype='f4')
pong = ctx.texture((width, height), 4, dtype='f4')
fbo_ping = ctx.framebuffer(ping)
fbo_pong = ctx.framebuffer(pong)
isPing = True
tracer_tex.use(2)
start = time.time()
if fp:
    writer = imageio.get_writer(fp, fps=fps, codec='libx264')
running = True
if length == 0:
    length = 1/fps
t = copy.copy(start_time)
tu = time.time()
frames_rendered = 0
while (t < length+start_time or forever) and running:
    frameIndex = 0
    while True:
        ssbo.write(get_ballslist(t))
        vertssbo.write(get_facelist(t))
        matssbo.write(get_matlist(t))
        fbo.use()
        fbo.clear(0.0, 0.0, 0.0, 1.0)
        program["frameIndex"].value = frameIndex
        program["t"].value = t
        vao.render(moderngl.TRIANGLES, vertices=6)
        ping.use(0)
        pong.use(1)
        if isPing:
            fbo_pong.use()
            accumulator_program["accumulated"].value = 0
            isPing = False
        else:
            fbo_ping.use()
            accumulator_program["accumulated"].value = 1
            isPing = True
        if show_progress:
            ctx.copy_framebuffer(ctx.screen, (fbo_ping if isPing else fbo_pong))
            pygame.display.flip()
        frames_rendered += 1
        accumulator_program["frameIndex"].value = frameIndex
        accumulator_program["frame"].value = 2
        accumulator_vao.render(moderngl.TRIANGLES, vertices=6)
        if frames_rendered % 100 == 0:
            print(f" t = {t:.2f}s, {frameIndex/rpp*100:.0f}% of frame {(t-start_time)*fps:.0f}/{length*fps:.0f}, fps {((((t-start_time)*fps)/(time.time()-start)) if t-start_time > 0 else 0.0):.2f}, {frames_rendered/(t*fps+1):.2f} samples per frame")
        frameIndex += 1
        dt = 1/fps - (time.time()-tu)
        if frameIndex > rpp and dt > 0 and not supersample:
            if not lock_fps:
                break
            else:
                time.sleep(dt)
        if dt < 0 and lock_fps:
            break
        if frameIndex > rpp:
            break
    tu = time.time()
    t += 1/fps

    out_fbo = fbo_ping if isPing else fbo_pong
    if fp:
        if length == 1/fps:
            Image.frombytes('RGB', out_fbo.size, out_fbo.read(), 'raw', 'RGB', 0, -1).save(fp)
        else:    
            writer.append_data(np.array(Image.frombytes('RGB', out_fbo.size, out_fbo.read(), 'raw', 'RGB', 0, -1)))
if fp:
    writer.close()
# Read from result (accumulator's texture)