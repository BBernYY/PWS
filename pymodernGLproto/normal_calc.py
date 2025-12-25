from PIL import Image
import numpy as np

def bump_to_normal(path, strength=1.0):
    img = Image.open(path).convert('L').resize((1024, 1024), Image.LANCZOS)
    h = np.array(img, dtype=np.float32) / 255.0

    dx = np.gradient(h, axis=1)
    dy = np.gradient(h, axis=0)

    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(h)

    normal = np.stack([nx, ny, nz], axis=-1)
    normal = normal / np.linalg.norm(normal, axis=-1, keepdims=True)

    # Convert [-1, 1] → [0, 255]
    normal_img = ((normal + 1.0) * 0.5 * 255).astype(np.uint8)
    return Image.fromarray(normal_img)