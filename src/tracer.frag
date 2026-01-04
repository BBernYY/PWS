#version 430 core
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform float FOV;
uniform vec3 cam_pos;
uniform mat3x3 view;
uniform uint randval;
uniform uint frameIndex;
uniform float aspect;
uniform float h;
uniform float t;
uniform float focus_distance;
uniform float focus_strength;

uniform sampler2D emission_tex;
uniform sampler2D fresnel_tex;
uniform sampler2D ao_tex;
uniform sampler2D displacement_tex;
uniform sampler2D normal_tex;
uniform sampler2D albedo_tex;

const int balls_len = 5;
const int faces_len = 576;
const int rpp = 1;
const int MAXBOUNCES = 5;
const int bbs_len = 1;
const int bindex_len = 576;

const float PI=3.14159265;

struct Material {
    vec4 color; // r, g, b, transparency
    vec4 brdf; // fresnel, smoothness
    float ao;
    float displacement;
    vec3 normal;
    vec3 emission;
};


struct Ball {
  vec4 pos; // x, y, z, r
  mat2x2 matpos;
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
  return vec4(doCollide);
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



struct Vert {
  vec3 pos;
  vec2 uv_coord;
};

struct Face {
  Vert verts[3];
  float exists;
};

struct hitInfo {
    float dist;
    vec3 pos;
    vec3 normal;
    vec3 indir;
    vec3 reflectdir;
    Material mat;
    vec3 ta;
};
struct Box {
  vec4 c1;
  vec4 c2;
};

layout(std430, binding = 9) buffer Balls {
    Ball balls[balls_len];
};
layout(std430, binding = 10) buffer fbuffer {
    vec4 faces_data[faces_len+1][4];
};
layout(std430, binding = 11) buffer bbbuffer {
    Box bbs[bbs_len];
};
layout(std430, binding = 12) buffer bindexbuffer {
    ivec2 bindices[bindex_len];
};

Face to_face(vec4 f[4]){
    return Face(Vert[3](Vert(f[0].xyz, vec2(f[0].w, f[1].x)), Vert(f[1].yzw, f[2].xy), Vert(vec3(f[2].zw, f[3].x), f[3].yz)), f[3].w);
}

struct collision_data {
    float t;
    vec2 local_uv;
    vec3 normal;
};

float boxcollide(Line l, Box b)
{
    vec3 invDir = 1.0 / l.dir;

    vec3 t0 = (b.c1.xyz - l.pos) * invDir;
    vec3 t1 = (b.c2.xyz - l.pos) * invDir;

    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float tenter = max(max(tmin.x, tmin.y), tmin.z);
    float texit  = min(min(tmax.x, tmax.y), tmax.z);

    if (texit >= max(tenter, 0.0)) {
        return tenter; // overlap length
    }

    return -1.0;
}


// own derivation, until w1 and w2
collision_data collide(Line l, Face face){
    vec3 dir1 = (face.verts[2].pos - face.verts[0].pos);
    vec3 dir2 = (face.verts[1].pos - face.verts[0].pos);
    
    vec3 normal = normalize(-cross(dir1, dir2));
    // if (dot(normal, l.dir) > 0) return collision_data(-1., vec2(0.), vec3(0.));
    float d = -dot(normal, face.verts[0].pos);
    float hit_t = -(dot(normal, l.pos)+d)/dot(normal, l.dir);
    vec3 hit_pos = l.pos+l.dir*hit_t;
    mat3x3 M = mat3x3(
      dir1, dir2, normal
      );
    vec2 hit_pos_prime = (inverse(M) * (hit_pos - face.verts[0].pos)).xy;
    if(hit_pos_prime.x > 0 && hit_pos_prime.y > 0 && hit_pos_prime.x + hit_pos_prime.y < 1) {
        return collision_data(hit_t, vec2(hit_pos_prime.x, hit_pos_prime.y), normal);
    } else {
      return collision_data(-1., vec2(0.), vec3(0.));
    }
}



vec2 dirToPolar(vec3 v) {
    float theta = atan(v.z, v.x);
    float phi = acos(clamp(v.y, -1.0, 1.0));
    return vec2(theta, phi);
}

vec3 uvmix(vec2 t){
  return vec3(t.x, t.y, 1. - t.x - t.y);
}

Material sample_tex(vec2 uv, vec2 dx, vec2 dy){
  uv -= vec2(0.5)/vec2(h * aspect, h);
  vec4 albedo = vec4(textureGrad(albedo_tex, uv, dx, dy).rgba);
  vec4 fresnel = textureGrad(fresnel_tex, uv, dx, dy).rgba;
  fresnel = vec4(fresnel.rgb, 1.-fresnel.a);
  float ao = textureGrad(ao_tex, uv, dx, dy).r;
  float displacement = textureGrad(displacement_tex, uv, dx, dy).r;
  vec3 normal = textureGrad(normal_tex, uv, dx, dy).rbg;
  vec3 emission = textureGrad(emission_tex, uv, dx, dy).rgb;
  emission *= (1/(1-emission) - 1);
  normal = normalize(2.*normal-1.);

  
  return Material(albedo, fresnel, ao, displacement, normal, emission);
}

Material get_uv(mat3x2 posmat, vec3 imgpos, vec2 dx, vec2 dy){
  dx *= posmat[0] - posmat[2];
  dy *= posmat[1] - posmat[2];
  return sample_tex(posmat * imgpos, dx, dy);
}
Material get_rect_uv(mat2x2 posmat, vec2 imgpos, vec2 dx, vec2 dy){
  dx *= posmat[1].x-posmat[0].x;
  dy *= posmat[1].y-posmat[0].y;

  return sample_tex(vec2(posmat[0]+imgpos*(posmat[1]-posmat[0])), dx, dy);
}

hitInfo getHit(Line newray, Ball[balls_len] objects, Face[faces_len+1] faces) {
    float chosent = 1e29;
    Ball chosen = balls[balls_len-1];
    float myvert_t = 1e30;
    collision_data intfacecol;
    Face intface = Face(Vert[3](Vert(vec3(0.), vec2(0.)), Vert(vec3(0.), vec2(0.)), Vert(vec3(0.), vec2(0.))), 0.);
    for(int bindex_index = 0; bindex_index < bindex_len; bindex_index++){
        int boxIndex = bindices[bindex_index].x;
        Box box = bbs[boxIndex];
        float ins = boxcollide(newray, box);
        if(ins > -0.001){
          Face face = faces[bindices[bindex_index].y];
          if (face.exists == 0) continue;
          collision_data facecol = collide(newray, face);
          if (facecol.t < 0) continue;
          if (facecol.t > 1000) continue;
          if (facecol.t < myvert_t) {
            intface = face;
            intfacecol = facecol;
            myvert_t = facecol.t;
            }
        }
    }
    for (int object_index = 0; object_index < balls_len-1; object_index++){
        
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
      vec3 ta = vec3(normal.z, normal.y, -normal.x);
      float x;
      float y;
      float em;
      vec2 thetaphi = dirToPolar(normal);
      if(chosent>10000.){
        x = (PI+dirToPolar(newray.dir).x)/(2*PI);
        y = dirToPolar(newray.dir).y/(PI);
        em = 0.0;
      } else {
        x = mod(thetaphi.x*chosen.pos.w, 1.);
        y = mod((0.5*PI-thetaphi.y)*chosen.pos.w, 1.);
        em = 1.0;
      }
      vec2 dx = vec2(1.0 / h / aspect * 5., 0.0);
      vec2 dy = vec2(0.0, 1.0 / h * 5.);
      Material matty = get_rect_uv(chosen.matpos, vec2(x,y), dx, dy);
      matty.emission *= em;
      return hitInfo(chosent, pos, normal, newray.dir, reflectdir, matty, ta);
    } else {
      vec3 pos = myvert_t*newray.dir + newray.pos;
      vec3 normal = intfacecol.normal;
      vec3 reflectdir = newray.dir - 2*dot(newray.dir, normal) * normal;
      vec2 dx = vec2(1.0 / h / aspect / 5., 0.0);
      vec2 dy = vec2(0.0, 1.0 / h / 5.);
      mat3x2 posmat = mat3x2(
        intface.verts[2].uv_coord,
        intface.verts[1].uv_coord,
        intface.verts[0].uv_coord
      );
      Material matty = get_uv(posmat, uvmix(intfacecol.local_uv), dx, dy);
      vec3 ta = normalize(intface.verts[2].pos - intface.verts[0].pos);
      return hitInfo(myvert_t, pos, normal, newray.dir, reflectdir, matty, ta);
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
  if (outdir.y > 0.0001 && dotwiwm > 0.0001){
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
    return brdf_data(mat.color.rgb*mat.ao/PI*(1-mat.brdf.rgb), diffusedir);
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

vec3 trace(Line ray, Ball[balls_len] objects, Face[faces_len+1] faces, inout uint rngState) {
    vec3 filt = vec3(1.0);
    vec3 throughput = vec3(0.);
    brdf_data bibi = brdf_data(vec3(1.), vec3(1.));
    for (int i = 0; i < MAXBOUNCES; i++) {
        hitInfo hit = getHit(ray, objects, faces);
        filt = filt * bibi.reflectance;
        throughput = throughput + filt * hit.mat.emission;
        if (hit.dist > 10000.0) {
            break;
        }
        bibi = BRDF(hit, hit.mat, rngState);
        vec3 dire = bibi.outdir;
        ray = Line(hit.pos + 0.001*hit.normal, dire);
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
    vec3 cam_space = normalize(vec3(uv.x*FOV_radian*aspect, uv.y*FOV_radian, 1.));
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
  Face faces[faces_len+1];
  for (int i = 0; i < faces_len+1; i++){
      faces[i] = to_face(faces_data[i]);
  }
  vec3 colly = vec3(0.);
  for (int i = 0; i < rpp; i++){
    Line ray = cam(uv, rngState);
    colly = colly + trace(ray, balls, faces, rngState)/rpp;
    //colly = colly + RandomDirection(rngState);
  }
  // gl_FragColor = vec4(vec3(float(frameIndex)/1000.), 1.0+colly.r);
  fragColor = vec4(colly, 1.+t);
  // balls[6] = Ball(vec4(bbs[0].c1.xyz, 1.), balls[0].matpos);
  // balls[7] = Ball(vec4(bbs[0].c2.xyz, 1.), balls[0].matpos);
  // fragColor = vec4(vec3(boxcollide(cam(uv, rngState), bbs[1]))*0.01+colly*0.5, 1.);
  // fragColor = vec4(textureGrad(albedo_tex, mix(balls[int(t)].matpos[0], balls[int(t)].matpos[1], floor(mod((t*2),2)/2+0.5))+uv*0.5, vec2(0.), vec2(0.)).rgb, 1.);
}