from PIL import Image
from normal_calc import *
import os
old_matlist = [
    [
        [1.0, 1.0, 1.0, 0],  # color (r,g,b), emission
        [1.0, 1.0, 1.0, 0.97],  # smoothness, padding...
    ],
    [
        [0.9, 0.3, 0.3, 0.0],
        [0.04, 0.04, 0.04, 0.9],
    ],
    # subject 3
    [
        [0.2, 0.9, 0.11, 0.0],
        [0.04, 0.04, 0.04, 0.9],
    ],
    # subject 4
    [
        [0.1, 0.2, 0.6, 0.0],
        [0.1, 0.2, 0.8, 0.9],
    ],
    # sun
    [
        [0.9, 0.9, 0.9, 0.9],
        [0.9, 0.9, 0.9, 0.1],
    ],
    # ground
    [
        [0.6, 0.6, 0.6, 0.0],
        [0.4, 0.4, 0.4, 0.2],
    ],
    # skybox pad
    [
        [0.0, 0.0, 0.0, 0.6],
        [0.0, 0.0, 0.0, 0.0]
    ],
    #skybox pad
    [
        [0.0, 0.0, 0.0, 0.6],
        [0.0, 0.0, 0.0, 0.0]
    ],
    #compare ball 1
    [
        [0.9, 0.9, 0.9, 0],
        [0.9, 0.9, 0.9, 0.99]
    ],
    #compare ball 2
    [
        [0.9, 0.3, 0.3, 0],
        [0.9, 0.3, 0.3, 0.95]
    ],
    #compare ball 3
    [
        [0.2, 0.9, 0.11, 0],
        [0.2, 0.9, 0.11, 0.9]
    ],
    #compare ball 4
    [
        [0.1, 0.2, 0.9, 0],
        [0.1, 0.2, 0.9, 0.85]
    ],
]
old_mats = np.array(255*np.array(old_matlist), dtype=np.uint8)
parts = ['Albedo', 'Specular', 'Occlusion', 'Displacement', 'Normals', 'Emission']
col = ['RGBA', 'RGBA', 'L', 'L', 'RGB', 'RGB']
items = ["./mats/Brick/Textures/Brick 1 {i}.png", "./mats/Metal/Textures/Metal 5 {i}.png", "./mats/Concrete/Textures/Concrete 1 {i}.png", "./mats/Dirt/Textures/Dirt 5 {i}.png", "./mats/Grass/Textures/Grass 2 {i}.png"]

for part_ind, part in enumerate(parts):
    nu = Image.new(col[part_ind], (1024*6, 1024*6))
    for i in range(len(items)):
        fp = items[i].replace("{i}", part)
        print(fp)
        if os.path.exists(fp):
            pic = Image.open(fp).convert(col[part_ind]).resize((1024, 1024), Image.LANCZOS)
        else:
            newfp = items[i].replace("{i}", "bump")
            match part:
                case 'Normals':
                    if os.path.exists(newfp):
                        pic = bump_to_normal(newfp).convert(col[part_ind])
                    else:
                        pic = Image.fromarray(np.full((1024, 1024, 3), [255*0.5, 255, 255*0.5], dtype=np.uint8), col[part_ind])
                case 'Displacement':
                    if os.path.exists(newfp):
                        pic = Image.open(items[i].replace("{i}", 'bump')).resize((1024, 1024), Image.LANCZOS).convert(col[part_ind])
                    else:
                        pic = Image.fromarray(np.full((1024, 1024), 0, dtype=np.uint8), col[part_ind])
                case 'Specular':
                    pic = Image.fromarray(np.full((1024, 1024, 4), [255*0.04, 255*0.04, 255*0.04, 0.5], dtype=np.uint8), col[part_ind])
                case 'Occlusion':
                    pic = Image.fromarray(np.full((1024, 1024), 255, dtype=np.uint8), col[part_ind])
                case 'Emission':
                    pic = Image.fromarray(np.full((1024, 1024, 3), [0, 0, 0], dtype=np.uint8), col[part_ind])
                case _:
                    raise FileNotFoundError(fp)
        nu.paste(pic, ((i % 6)*1024, (i // 6)*1024))
    for j in range(len(old_mats)):
        match part:
            case 'Albedo':
                dat = np.array(old_mats[j][0][:-1])
            case 'Specular':
                dat = np.array(old_mats[j][1])
            case 'Occlusion':
                dat = np.array([255, 255, 255])
            case 'Displacement':
                dat = np.array([0, 0, 0])
            case 'Normals':
                dat = np.array([128, 128, 255])
            case 'Emission':
                dat = old_mats[j][0][-1]*np.array(old_mats[j][0][:-1])
            case _:
                raise GoonError
        nu.paste(Image.fromarray(np.tile(dat, (1024, 1024, 1)).astype(np.uint8)).convert( col[part_ind]), (((i+j) % 6)*1024, ((i+j) // 6)*1024))
    match part:
        case 'Albedo':
            nu.paste(Image.open('./mats/sky_19_2k.png'), (4*1024, 1024))
        case 'Emission':
            nu.paste(Image.open('./mats/sky_19_2k.png'), (4*1024, 1024))
    nu.save(f"./textures/{part}.png")