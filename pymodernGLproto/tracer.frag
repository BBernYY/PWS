#version 430 core
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform float t;
uniform float FOV;
uniform vec3 cam_pos;
uniform mat3x3 view;
uniform uint randval;
uniform uint frameIndex;
uniform vec4 envpos;
uniform vec4 envdir;
uniform vec4 envfloor;
uniform float aspect;
uniform float focus_distance;
uniform float focus_strength;

const int balls_len = 6;
const int faces_len = 0;
const int mats_len = 6;
const int rpp = 10;
const int MAXBOUNCES = 5;

const float PI=3.14159265;

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



vec4 getEnviromentLight(vec3 dir) {
  if (dir.y > -0.2) {
    return mix(envpos, envdir, 0.4*dir.y+0.6);
  } else {
    return envfloor;
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
    vec4 faces[faces_len+1][3];
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

hitInfo getHit(Line newray, Ball[balls_len] objects, vec4[faces_len+1][3] faces) {
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
      vec3 reflectdir = newray.dir - 2*dot(newray.dir, normal) * normal;
      return hitInfo(chosent, pos, normal, newray.dir, reflectdir, chosen.mat);
    } else {
      vec3 pos = myvert_t*newray.dir + newray.pos;
      vec3 normal = intfacecol.normal;
      vec3 reflectdir = newray.dir - 2*dot(newray.dir, normal) * normal;
      vec3 mixy = uvmix(intfacecol.local_uv);
      Material matty = Material(mixy.x*mats[uint(intface[2].w)-1].color + mixy.y*mats[uint(intface[1].w)].color + mixy.z*mats[uint(intface[0].w)-1].color, mixy.x*mats[uint(intface[2].w)-1].brdf + mixy.y*mats[uint(intface[1].w)-1].brdf + mixy.z*mats[uint(intface[0].w)-1].brdf);
      return hitInfo(myvert_t, pos, normal, newray.dir, reflectdir, matty);
    }
}

vec3 Schlick(vec3 r0, float deg){
    float exponential = pow(1. - deg, 5.);
    return r0 + (1. - r0) * exponential;
}

//====================================================================
// non height-correlated masking-shadowing function is described here:
float Gmask(vec3 wi, vec3 wo, float a2)
{
    float dotNL = wi.y;
    float dotNV = wo.y;

    float denomA = dotNV * sqrt(a2 + (1. - a2) * dotNL * dotNL);
    float denomB = dotNL * sqrt(a2 + (1. - a2) * dotNV * dotNV);

    return 2. * dotNL * dotNV / (denomA + denomB);
}

struct brdf_data {
  vec3 reflectance;
  vec3 outdir;
};

brdf_data BRDF_specular(hitInfo hit, Material mat, mat3x3 M, inout uint rngState) {
  // https://schuttejoe.github.io/post/ggximportancesamplingpart1/
  float a = mat.brdf.a;
  float a2 = a * a;
  float r1 = RandomValue(rngState);
  float r2 = RandomValue(rngState);
  vec3 ind = -hit.indir * M;


  vec3 reflectance = vec3(0., 0., 0.);
  float theta = acos(sqrt((1.0 - r1) / ((a2 - 1.) * r1 + 1.)));
  float phi = 2*PI*r2;
  vec3 facetnormal = normalize(vec3(sin(theta)*cos(phi), cos(theta), sin(theta)*(sin(phi))));
  vec3 outdir = normalize(2. * dot(ind, facetnormal) * facetnormal - ind);
  float dotwiwm = dot(outdir, facetnormal);
  if (outdir.y > 0.001 && dotwiwm > 0.001){
    vec3 F = Schlick(mat.brdf.rgb, dotwiwm);
    float G = Gmask(outdir, ind, a2);
    float weight = abs(dot(ind, facetnormal)) / (ind.y * facetnormal.y);
    reflectance = F*G*weight;
  }
  outdir = normalize(outdir * transpose(M));

  return brdf_data(reflectance, outdir);
}

vec3 randomHemisphereDirection(inout uint rngState){
  float r1 = RandomValue(rngState);
  float r2 = RandomValue(rngState);
  float theta = acos(sqrt(1.0 - r1));
  float phi = 2*PI*r2;
  return vec3(sin(theta)*cos(phi), cos(theta), sin(theta)*(sin(phi)));
}

brdf_data BRDF_diffuse(hitInfo hit, Material mat, mat3x3 M, inout uint rngState) {
    vec3 diffusedir = randomHemisphereDirection(rngState) * transpose(M);
    float s = mat.brdf.a;
    return brdf_data(mat.color.rgb/PI*(1-mat.brdf.rgb), diffusedir);
}

mat3x3 makeBasis(vec3 n) {
    vec3 up = vec3(0., 1., 0.);
    vec3 t = normalize(cross(up, n));
    vec3 b = cross(n, t);
    return mat3x3(t, n, b);
}


brdf_data BRDF(hitInfo hit, Material mat, inout uint rngState) {
    mat3x3 M = makeBasis(hit.normal);
    brdf_data diffuse = BRDF_diffuse(hit, mat, M, rngState);
    brdf_data specular = BRDF_specular(hit, mat, M, rngState);
    float r3 = RandomValue(rngState);
    if (r3 < 0.5){
      return diffuse;
    } else {
      return specular;
    }
}

vec3 trace(Line ray, Ball[balls_len] objects, vec4[faces_len+1][3] faces, inout uint rngState) {
    vec3 filt = vec3(1.0);
    vec3 throughput = vec3(0.);
    brdf_data bibi = brdf_data(vec3(1.), vec3(1.));
    for (int i = 0; i < MAXBOUNCES; i++) {
        hitInfo hit = getHit(ray, objects, faces);
        if (hit.dist > 10000.0) {
            hit.mat.color = getEnviromentLight(hit.reflectdir);
            hit.mat.brdf.a = 1.;
        }
        bibi = BRDF(hit, hit.mat, rngState);
        filt = filt * bibi.reflectance;
        throughput = throughput + filt * hit.mat.color.a;
        if (hit.dist > 10000.0) {
            break;
        }
        vec3 dire = bibi.outdir;
        ray = Line(hit.pos + 0.01*hit.normal, dire);
    }
    
    return throughput;
    // return ;

}

mat3 rotateX(float angle) {
    float c = cos(angle);
    float s = sin(angle);

    // Columns of the matrix
    return mat3(
        vec3(1.0, 0.0, 0.0),  // first column
        vec3(0.0, c, s),       // second column
        vec3(0.0, -s, c)       // third column
    );
}
mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);

    // Columns of the matrix
    return mat3(
        vec3(c, 0.0, -s),     // first column
        vec3(0.0, 1.0, 0.0),  // second column
        vec3(s, 0.0, c)       // third column
    );
}
Line cam(vec2 uv, inout uint rngState) {
    float theta = RandomValue(rngState)*2*PI;
    vec3 ch = focus_strength*vec3(vec2(cos(theta), sin(theta)), 0.);
    float FOV_radian = FOV/180*PI;
    float phi = RandomValue(rngState)*2*PI;
    uv += 0.001*vec2(cos(phi), sin(phi));
    vec3 cam_space = normalize(vec3(uv.x*FOV_radian, uv.y*FOV_radian*aspect, 1.));
    vec3 pos = cam_pos + ch*view;
    cam_space -= ch/focus_distance;
    return Line(pos, cam_space * view);
}


uint hash2(uvec2 v) {
    v = (v << 13u) ^ v;
    return (v.x * 15731u) ^ (v.y * 789221u) + 1376312589u;
}

void main() {
  uint seed = randval ^ uint(gl_FragCoord.x) * 1973u ^
            uint(gl_FragCoord.y) * 9277u ^
            (frameIndex * 26699u);
  seed = wang_hash(seed);

  uint rngState = seed;

  vec3 colly = vec3(0.);
  for (int i = 0; i < rpp; i++){
    Line ray = cam(uv, rngState);
    colly = colly + trace(ray, objects, faces, rngState)/rpp;
    //colly = colly + RandomDirection(rngState);
  }
  //gl_FragColor = vec4(vec3(float(frameIndex)/1000.), 1.0+colly.r);
  fragColor = vec4(colly, 1.+t);
}
