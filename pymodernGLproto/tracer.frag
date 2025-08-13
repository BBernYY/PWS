#version 430 core
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform float t;

const int balls_len = 4;
const int faces_len = 16;
const int mats_len = 6;
const int rpp = 10;
const int MAXBOUNCES = 5;



struct Material {
    vec4 color; // r, g, b, emission
    vec4 brdf; // smoothness, None, None, None
};

struct Ball {
  vec4 pos; // x, y, z, r
  Material mat;
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


vec4 ballcollide(Line l, Ball c) {
  float doCollide = fsquare(2.0 * dot(l.pos - c.pos.xyz, l.dir)) - 4.0 * dot(l.dir, l.dir) * (dot(l.pos - c.pos.xyz, l.pos - c.pos.xyz) - fsquare(c.pos.w));
  return vec4(c.mat.color.rgb, doCollide);
}

CollisionT ballcollision(Line l, Ball c) {
  float D = ballcollide(l, c).a;
  float sqrtD = sqrt(D)/(2.*dot(l.dir, l.dir));
  float inter = (-(2. * dot(l.pos - c.pos.xyz, l.dir)))/(2.*dot(l.dir, l.dir));
  float cp1 = inter + sqrtD;
  float cp2 = inter - sqrtD;
  return CollisionT(cp1, cp2, D);
}

// vec3 checklightpoint(vec3 origin, Ball c, vec3 lightpoint) {
//   Line l = Line(origin, normalize(lightpoint - origin));
//   CollisionT col = collision(l, c);
//   vec3 normal = normalize(origin - c.pos.xyz);
//   float t = (col.t1 == 0.) ? col.t2 : col.t1;
//   return vec3((max(0., dot(l.dir, normal)) + 0.1)*c.mat.color.rgb);
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


vec4 getEnviromentLight(vec3 dir) {
  if (dir.y > -0.2) {
    return vec4(0.6+0.3*dir.y, 0.5+0.5*dir.y, 0.9+0.1*dir.y, 0.5+0.3*sin(0.2*t));
  } else {
    return vec4(0.4, 0.4, 0.4, 0.2);
  }
}

struct hitInfo {
    float dist;
    vec3 pos;
    vec3 normal;
    vec3 indir;
    vec3 reflectdir;
    Material mat;
};

layout(std430, binding = 5) buffer Balls {
    Ball objects[balls_len];
};
layout(std430, binding = 4) buffer fbuffer {
    vec4 faces[faces_len][3];
};
layout(std430, binding = 3) buffer mbuffer {
    Material mats[mats_len];
};

struct collision_data {
    float t;
    vec2 local_uv;
    vec3 normal;
};



// own derivation, until w1 and w2
collision_data collide(Line l, vec4 face[3]){
    vec3 dir1 = (face[2].xyz - face[0].xyz);
    vec3 dir2 = (face[1].xyz - face[0].xyz);
    
    vec3 normal = normalize(-cross(dir1, dir2));
    // if (dot(normal, l.dir) > 0) return collision_data(-1., vec2(0.), vec3(0.));
    float d = -dot(normal, face[0].xyz);
    float hit_t = -(dot(normal, l.pos)+d)/dot(normal, l.dir);
    vec3 hit_pos = l.pos+l.dir*hit_t;
    mat3x3 M = mat3x3(
      dir1, dir2, normal
      );
    vec2 hit_pos_prime = (inverse(M) * (hit_pos - face[0].xyz)).xy;
    if(hit_pos_prime.x > 0 && hit_pos_prime.y > 0 && hit_pos_prime.x + hit_pos_prime.y < 1) {
        return collision_data(hit_t, vec2(hit_pos_prime.x, hit_pos_prime.y), normal);
    } else {
      return collision_data(-1., vec2(0.), vec3(0.));
    }
}

vec3 uvmix(vec2 t){
  return vec3(t.x, t.y, 1. - t.x - t.y);
}

hitInfo getHit(Line newray, Ball[balls_len] objects, vec4[faces_len][3] faces) {
    float chosent = 1e29;
    Ball chosen = Ball(vec4(0.), Material(getEnviromentLight(newray.dir), vec4(0.)));
    float myvert_t = 1e30;
    collision_data intfacecol;
    vec4 intface[3] = vec4[](vec4(0.), vec4(0.), vec4(0.));
    for(int face_index = 0; face_index < faces_len; face_index++){
      vec4 face[3] = faces[face_index];
      if (face[0].w == 0.) continue;
      collision_data facecol = collide(newray, face);
      if (facecol.t < 0) continue;
      if (facecol.t > 1000) continue;
      if (facecol.t < myvert_t) {
        intface = face;
        intfacecol = facecol;
        myvert_t = facecol.t;
      }

    }
    for (int object_index = 0; object_index < balls_len; object_index++){
        
        Ball obj = objects[object_index];
        if (obj.pos.w == 0) continue; // radius=0 means not loaded
        CollisionT collis = ballcollision(newray, obj);
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
    if (chosent < myvert_t){
      vec3 pos = chosent*newray.dir + newray.pos;
      vec3 normal = normalize(pos - chosen.pos.xyz);
      vec3 reflectdir = newray.dir - 2 * dot(newray.dir, normal) * normal;
    return hitInfo(chosent, pos, normal, newray.dir, reflectdir, chosen.mat);
    } else {
      vec3 pos = myvert_t*newray.dir + newray.pos;
      vec3 normal = intfacecol.normal;
      vec3 reflectdir = newray.dir - 2 * dot(newray.dir, normal) * normal;
      vec3 mixy = uvmix(intfacecol.local_uv);
      Material matty = Material(mixy.x*mats[uint(intface[2].w)].color + mixy.y*mats[uint(intface[1].w)].color + mixy.z*mats[uint(intface[0].w)].color, mixy.x*mats[uint(intface[2].w)].brdf + mixy.y*mats[uint(intface[1].w)].brdf + mixy.z*mats[uint(intface[0].w)].brdf);
      return hitInfo(myvert_t, pos, normal, newray.dir, reflectdir, matty);
    }
}



vec3 BRDF(hitInfo hit, Material mat, inout uint rngState) {
    vec3 diffusedir = randomHemisphereDirection(rngState, hit.normal);
    float s = mat.brdf.r;
    return diffusedir*s + normalize(hit.reflectdir)*(1-s);
}

vec3 trace(Line ray, Ball[balls_len] objects, vec4[faces_len][3] faces, inout uint rngState) {
    vec3 accum = vec3(0.0);
    vec3 throughput = vec3(1.0);
    for (int i = 0; i < MAXBOUNCES; i++) {
        hitInfo hit = getHit(ray, objects, faces);
        if (hit.dist > 10000.0) {
            accum += throughput * getEnviromentLight(ray.dir).rgb;
            break;
        }
        accum += throughput * hit.mat.color.rgb * hit.mat.color.a; // emission term
        throughput *= hit.mat.color.rgb;
        vec3 dir = BRDF(hit, hit.mat, rngState);
        ray = Line(hit.pos + 0.001*hit.normal, dir);
    }
    return accum;

}


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

  vec3 colly = vec3(0.);
  for (int i = 0; i < rpp; i++){
    vec3 uvdir = vec3(uv, 0.5);
    Line ray = Line(vec3(0., 1., 0.), normalize(uvdir+0.001*randomHemisphereDirection(rngState, uvdir)));
    colly = colly + trace(ray, objects, faces, rngState)/rpp;
    //colly = colly + RandomDirection(rngState);
  }
  //gl_FragColor = vec4(vec3(float(frameIndex)/1000.), 1.0+colly.r);
  fragColor = vec4(colly, 1.+t);
}