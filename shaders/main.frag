#version 330

in vec2 v_uv;
out vec4 fragColor;
void main() {
    fragColor = vec4(v_uv.x, v_uv.y, 1., 1.0);
}
