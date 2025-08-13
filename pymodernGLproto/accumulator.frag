#version 330 core
in vec2 uv;
out vec4 fragColor;

uniform sampler2D accumulated; // prev frame
uniform sampler2D frame;       // current frame
uniform int frameIndex;

void main() {
    vec2 newuv = uv * 0.5 + 0.5;
    vec4 cur  = texture(frame, newuv);
    vec4 prev = texture(accumulated, newuv);

    float weight = 1.0 / (float(frameIndex) + 1.0);
    fragColor = clamp(prev * (1.0 - weight) + cur * weight, 0.0, 1.0);
}
