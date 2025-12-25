import trimesh
import numpy as np
import re

s = 1/6/(1024+4*2)
texcor = lambda i: [(i % 6)/6+4.5*s, (i // 6)/6+4.5*s, (i % 6)/6+1024*s+4.5*s, (i // 6)/6+1024*s+4.5*s]
ob = trimesh.creation.torus(1,0.5,24,12)
# Export to a readable GLTF file
x1, y1, x2, y2 = texcor(5)
name = 'torus'
fp = f'objects/{name}_{len(ob.faces)}.obj'
ob.export(f'objects/torus_{len(ob.faces)}.obj')
p = re.compile(r"f ([0-9]+) ([0-9]+) ([0-9]+)")
with open(fp, 'r') as f:
    d = f.read()
vt = f"""
vt {x1} {y2}
vt {x2} {y2}
vt {x2} {y1}
vt {x1} {y1}
"""
with open(fp, 'w') as f:
    f.write(vt+'\n'+p.sub(r"f \1/1 \2/2 \3/3", d))