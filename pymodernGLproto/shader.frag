#version 330 core
precision highp float;

in vec2 uv;


struct Material {
    vec3 color;
    float emission;    
};

struct Ball {
  vec3 pos;
  Material mat;
  float r;
};

struct Line {
  vec3 pos;
  vec3 dir;
};

struct CollisionT {
    float t1;
    float t2;
    float D;
};

float fsquare(float f) {
  return f*f;
}
// float rand(uint seed) {
//     seed = (seed ^ 61u) ^ (seed >> 16u);
//     seed *= 9u;
//     seed ^= seed >> 4u;
//     seed *= 0x27d4eb2du;
//     seed ^= seed >> 15u;
//     return float(seed) * 2.3283064365387e-10;
// }
// https://github.com/riccardoscalco/glsl-pcg-prng/blob/main/index.glsl
// uint pcg(uint v) {
// 	uint state = v * uint(747796405) + uint(2891336453);
// 	uint word = ((state >> ((state >> uint(28)) + uint(4))) ^ state) * uint(277803737);
// 	return (word >> uint(22)) ^ word;
// }

// float rand (float p) {
// 	return float(pcg(uint(p))) / float(uint(0xffffffff));
// }

// cosine-weighted hemisphere around N, Y-up local space, ChatGPT
// vec3 cosineHemisphere(uint seed, vec3 N) {
//     float u1 = rand(seed);
//     float u2 = rand(seed ^ 0x9e3779b9u);

//     // sample on disk (XZ-plane for Y-up)
//     float r = sqrt(u1);
//     float phi = 6.28318530718 * u2;
//     float x = r * cos(phi);
//     float z = r * sin(phi);
//     float y = sqrt(max(0.0, 1.0 - u1)); // "up" in local space is Y

//     // build orthonormal basis with N as 'up'
//     vec3 T = normalize(abs(N.y) > 0.1 ? vec3(N.z, 0.0, -N.x): vec3(-N.z, 0.0, N.x));
//     vec3 B = cross(T, N);
//     return normalize(x * T + z * B + y * N);
// }


vec4 collide(Line l, Ball c) {
  float doCollide = fsquare(2.0 * dot(l.pos - c.pos, l.dir)) - 4.0 * dot(l.dir, l.dir) * (dot(l.pos - c.pos, l.pos - c.pos) - fsquare(c.r));
  return vec4(c.mat.color, doCollide);
}

CollisionT collision(Line l, Ball c) {
  float D = collide(l, c).a;
  float sqrtD = sqrt(D)/(2.*dot(l.dir, l.dir));
  float inter = (-(2. * dot(l.pos - c.pos, l.dir)))/(2.*dot(l.dir, l.dir));
  float cp1 = inter + sqrtD;
  float cp2 = inter - sqrtD;
  return CollisionT(cp1, cp2, D);
}

// vec3 checklightpoint(vec3 origin, Ball c, vec3 lightpoint) {
//   Line l = Line(origin, normalize(lightpoint - origin));
//   CollisionT col = collision(l, c);
//   vec3 normal = normalize(origin - c.pos);
//   float t = (col.t1 == 0.) ? col.t2 : col.t1;
//   return vec3((max(0., dot(l.dir, normal)) + 0.1)*c.mat.color);
// }


uint wang_hash(uint s) {
    s = (s ^ 61u) ^ (s >> 16u);
    s *= 9u;
    s = s ^ (s >> 4u);
    s *= 0x27d4eb2du;
    s = s ^ (s >> 15u);
    return s;
}




uniform uint frameIndex;
uint NextRandom(inout uint state)
{
  state = state * 747796405u + 2891336453u;
  uint result = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  result = (result >> 22u) ^ result;
  return result;
}

float RandomValue(inout uint state)
{
  return float(NextRandom(state)) / 4294967296.0;
}

// ChatGPT - eindelijk de fix gevonden na ~4 uur
vec3 randomHemisphereDirection(inout uint state, vec3 normal) {
    float u1 = RandomValue(state);
    float u2 = RandomValue(state);

    // Cosine-weighted
    float r = sqrt(u1);
    float theta = 2.0 * 3.14159265 * u2;

    float x = r * cos(theta);
    float y = r * sin(theta);
    float z = sqrt(1.0 - u1);

    // Build tangent space basis
    vec3 up = abs(normal.z) < 0.999 ? vec3(0,0,1) : vec3(1,0,0);
    vec3 tangent = normalize(cross(up, normal));
    vec3 bitangent = cross(normal, tangent);

    // Transform to world space
    return tangent * x + bitangent * y + normal * z;
}


const int balls_len = 6;
const int rpp = 500;
const int N = 10;
const int M = 3;

vec3 getEnviromentLight(vec3 dir) {
  if (dir.y > -0.2) {
    return vec3(0.6+0.3*dir.y, 0.5+0.5*dir.y, 0.9+0.1*dir.y);
  } else {
    return vec3(0.4, 0.4, 0.4);
  }
}

struct hitInfo {
    float dist;
    vec3 pos;
    vec3 normal;
    vec3 indir;
    Ball subject;
};

hitInfo getHit(Line newray, Ball[balls_len] objects) {
    float chosent = 1e30;
    Ball chosen = Ball(vec3(0.), Material(getEnviromentLight(newray.dir), 0.), 1.);
    for (int object_index = 0; object_index < balls_len; object_index++){
        
        Ball obj = objects[object_index];
        CollisionT collis = collision(newray, obj);
        if (collis.D > 0) {
            collis.t1 = collis.t1 > 0 ? collis.t1 : 1e31;
            collis.t2 = collis.t2 > 0 ? collis.t2 : 1e31;
            float myt = min(collis.t1, collis.t2);
            if (myt > 0 && myt < chosent) {
                chosen = obj;
                chosent = myt;
            }
        }
    }
    vec3 pos = chosent*newray.dir + newray.pos;
    vec3 normal = normalize(pos - chosen.pos);
    return hitInfo(chosent, pos, normal, newray.dir, chosen);
}

vec3 trace(Line ray, Ball[balls_len] objects, inout uint rngState) {
    int i = 0;
    vec3 color = vec3(1.);
    Line newray = ray;
    float emission = 0.;
    while(true) {
        hitInfo hit = getHit(newray, objects);
        emission = hit.subject.mat.emission;
        color = vec3(color.r*hit.subject.mat.color.r, color.g*hit.subject.mat.color.g, color.b*hit.subject.mat.color.b);
        if (hit.dist > 10000 || emission > 0.2) break;
        vec3 dir = randomHemisphereDirection(rngState, hit.normal);
        newray = Line(hit.pos+0.001*hit.normal, dir);
        i++;
        if (i > 5) break;  // must have a break condition to avoid infinite loop
    }
    return color*emission;
}

uniform float t;
uniform vec2 wsize;

uint hash2(uvec2 v) {
    v = (v << 13u) ^ v;
    return (v.x * 15731u) ^ (v.y * 789221u) + 1376312589u;
}

void main() {
  uint seed = uint(gl_FragCoord.x) * 1973u ^
            uint(gl_FragCoord.y) * 9277u ^
            (frameIndex * 26699u);
  seed = wang_hash(seed);

  uint rngState = seed;

  Ball objects[balls_len] = Ball[](
    Ball(vec3(3., 2.*sin(20.*t)+1., 3.), Material(vec3(0.9, 0.9, 0.8), 0.), 1.), // subject
    Ball(vec3(1., 2.*sin(20.*t+3.14159/2)+1., 3.), Material(vec3(0.9, 0.3, 0.2), 0.), 1.), // subject 2
    Ball(vec3(-1., 2.*sin(20.*t+3.14159)+1., 3.), Material(vec3(0.4, 0.9, 0.3), 0.), 1.), // subject 3
    Ball(vec3(-3., 2.*sin(20.*t+3.14159*1.5)+1., 3.), Material(vec3(0.2, 0.5, 0.9), 0.), 1.), // subject 4
    Ball(vec3(0., 9., 1.), Material(vec3(1., 0.9, 0.8), 1.), 5.), // sun
    Ball(vec3(0., -51., 0.), Material(vec3(0.5, 0.9, 0.5), 0.), 50.) // ground
  );
  

  vec3 colly = vec3(0.);
  for (int i = 0; i < rpp; i++){
    vec3 uvdir = vec3(uv, 1.);
    Line ray = Line(vec3(0., 1., 0.), normalize(uvdir+0.001*randomHemisphereDirection(rngState, uvdir)));
    colly = colly + trace(ray, objects, rngState)/rpp;
    //colly = colly + RandomDirection(rngState);
  }
  gl_FragColor = vec4(colly, 1.0);
  //gl_FragColor = vec4(vec3(rand(getseed(0))), 1.);
}