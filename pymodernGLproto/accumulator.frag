#version 330 core
in vec2 uv;
out vec4 fragColor;

uniform sampler2D accumulated; // prev frame
uniform sampler2D frame;       // current frame
uniform int frameIndex;
uniform bool do_postprocessing;
uniform float exposure;

vec3 toneMap_ACES(vec3 x) // HDR naar sRGB-algoritme van ChatGPT; ACES-Filmic
{
    x = clamp(x, 0., 1e32);
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    x = x * exposure;
    vec3 mapped = clamp((x*(a*x + b)) / (x*(c*x + d) + e), 0.0, 1.0);
    return pow(mapped, vec3(1.0 / 2.2));  // gamma correction
}


void main() {
    vec2 newuv = uv * 0.5 + 0.5;
    vec3 cur = texture(frame, newuv).rgb;
    vec3 prev = texture(accumulated, newuv).rgb;

    float weight = 1.0 / (float(frameIndex));
    vec3 col = cur * weight + prev * (1 - weight);
    if (do_postprocessing) {
        col = toneMap_ACES(col);
    }
    fragColor = vec4(col, 1.);
}
