#version 330 core
out vec2 uv;

// Positions for a fullscreen quad (two triangles)
vec2 positions[6] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),

    vec2( 1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0,  1.0)
);

void main() {
    vec2 pos = positions[gl_VertexID];
    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
    uv = pos;
}