import moderngl
import pygame
import numpy as np
import time
import imageio
from PIL import Image
import math
import copy
from nice_duration import duration_string as durs
from conf import *

if show_progress:
    pygame.init()
    pygame.display.set_mode((width, height), pygame.OPENGL | pygame.DOUBLEBUF)
    ctx = moderngl.create_context()
else:
    ctx = moderngl.create_standalone_context()


ssbo = ctx.buffer(get_ballslist(start_time))
verty, bbs, bindices = get_facelist_v2(start_time)
vertssbo = ctx.buffer(verty)
bbssbo = ctx.buffer(bbs)
bindssbo = ctx.buffer(bindices)
ssbo.bind_to_storage_buffer(binding=9)
vertssbo.bind_to_storage_buffer(binding=10)
bbssbo.bind_to_storage_buffer(binding=11)
bindssbo.bind_to_storage_buffer(binding=12)
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

t = copy.copy(start_time)

frameIndex = 0
def safe_uniform(val, data):
    global program, t
    try:
        program[val].value = data
    except KeyError:
        if t == start_time and frameIndex == 0:
            print(f"{val} is not used!")
def accumulator_safe_uniform(val, data):
    global accumulator_program, t
    try:
        accumulator_program[val].value = data
    except KeyError:
        if t == start_time and frameIndex == 0:
            print(f"{val} is not used!")

safe_uniform("albedo_tex", 3)
safe_uniform("fresnel_tex", 4)
safe_uniform("ao_tex", 5)
safe_uniform("displacement_tex", 6)
safe_uniform("normal_tex", 7)
safe_uniform("emission_tex", 8)

tracer_tex = ctx.texture((width, height), 4, dtype='f4')  # 4 = RGBA channels
fbo = ctx.framebuffer(tracer_tex)
accumulator_vao = ctx.vertex_array(accumulator_program, [])
ping = ctx.texture((width, height), 4, dtype='f4')
pong = ctx.texture((width, height), 4, dtype='f4')
albedo = Image.open('./textures/Albedo.png')
albedo_tex = ctx.texture(albedo.size, 4, albedo.tobytes())
albedo_tex.build_mipmaps()
albedo_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
albedo_tex.use(3)
fresnel = Image.open('./textures/Specular.png')
fresnel_tex = ctx.texture(fresnel.size, 4, fresnel.tobytes())
fresnel_tex.build_mipmaps()
fresnel_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
fresnel_tex.use(4)
ao = Image.open('./textures/Occlusion.png')
ao_tex = ctx.texture(ao.size, 1, ao.tobytes())
ao_tex.build_mipmaps()
ao_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
ao_tex.use(5)
displacement = Image.open('./textures/Displacement.png')
displacement_tex = ctx.texture(displacement.size, 1, displacement.tobytes())
displacement_tex.build_mipmaps()
displacement_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
displacement_tex.use(6)
normal = Image.open('./textures/Normals.png')
normal_tex = ctx.texture(normal.size, 3, normal.tobytes())
normal_tex.build_mipmaps()
normal_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
normal_tex.use(7)
emission = Image.open('./textures/Emission.png')
emission_tex = ctx.texture(emission.size, 3, emission.tobytes())
emission_tex.build_mipmaps()
emission_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
emission_tex.use(8)
fbo_ping = ctx.framebuffer(ping)
fbo_pong = ctx.framebuffer(pong)
isPing = True
tracer_tex.build_mipmaps()
tracer_tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
tracer_tex.use(2)
start = time.time()
if fp:
    writer = imageio.get_writer(fp, fps=time_fps, codec='libx264')
running = True
if length == 0:
    length = 1/time_fps
ta = time.time()
tu = time.time()
frames_rendered = 0
while (t < length+start_time or forever) and running:
    frameIndex = 0
    fov, cam_pos, view = get_cam(t)
    while True:
        stop = False
        ssbo.write(get_ballslist(t))
        verty, bbs, bindices = get_facelist_v2(t)
        vertssbo.write(verty)
        bbssbo.write(bbs)
        bindssbo.write(bindices)
        fbo.use()
        fbo.clear(0.0, 0.0, 0.0, 1.0)
        safe_uniform("frameIndex", frameIndex)
        safe_uniform("FOV", fov)
        safe_uniform("t", t)
        safe_uniform("cam_pos", cam_pos)
        safe_uniform("view", view.T.flatten())
        safe_uniform("randval", np.random.randint(0, 2**32))
        safe_uniform("aspect", width/height)
        safe_uniform("h", height)
        safe_uniform("focus_distance", focus_distance)
        safe_uniform("focus_strength", focus_strength)
        vao.render(moderngl.TRIANGLES, vertices=6)
        ping.use(0)
        pong.use(1)
        if isPing:
            fbo_pong.use()
            accumulator_safe_uniform("accumulated", 0)
            isPing = False
        else:
            fbo_ping.use()
            accumulator_safe_uniform("accumulated", 1)
            isPing = True
        dt = 1/render_fps - (time.time()-tu)
        frames_rendered += 1
        frameIndex += 1
        if frameIndex >= rpp and not supersample:
            stop = True
        if dt < 0 and lock_fps:
            stop = True
        time.sleep(pause)
        accumulator_safe_uniform("frameIndex", frameIndex)
        accumulator_safe_uniform("frame", 2)
        accumulator_program["do_postprocessing"] = stop
        accumulator_program["exposure"] = exposure
        accumulator_vao.render(moderngl.TRIANGLES, vertices=6)
        dt = 1/render_fps - (time.time()-tu)
        if show_progress and frames_rendered%hide_buildup == 0:
            ctx.copy_framebuffer(ctx.screen, (fbo_ping if not isPing else fbo_pong))
            pygame.display.flip()
        if stop:
            fov, cam_pos, view = get_cam(t)
            if (not frames_rendered%hide_buildup == 0) and show_progress:
                ctx.copy_framebuffer(ctx.screen, (fbo_ping if isPing else fbo_pong))
                pygame.display.flip()
            if lock_fps and dt > 0 and not supersample:
                time.sleep(dt)
            print(f"t = {t:2f}s\tframe {int((t+1/time_fps-start_time)*time_fps)}/{(int(length*time_fps))}\ttook {int(1000*(time.time()-tu))}ms\tsampled {frameIndex} frames\t {durs(seconds=(time.time()-ta)*(start_time+length-t+1/time_fps)/(t+1/time_fps-start_time))} left")
            break

    out_fbo = fbo_ping if isPing else fbo_pong
    if fp:
        if length == 1/time_fps:
            Image.frombytes('RGB', out_fbo.size, out_fbo.read(), 'raw', 'RGB', 0, -1).save(fp)
        else:    
            writer.append_data(np.array(Image.frombytes('RGB', out_fbo.size, out_fbo.read(), 'raw', 'RGB', 0, -1)))
    tu = time.time()
    t += 1/time_fps
if fp:
    writer.close()
