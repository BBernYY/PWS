precision highp float;

varying vec2 vTexCoord;
uniform vec2 wsize;
uniform float t;

struct Ball {
  vec3 pos;
  vec3 col;
  float r;
};

struct Line {
  vec3 pos;
  vec3 dir;
};

struct CollisionT {
    float t1;
    float t2;
};

float fsquare(float f) {
  return f*f;
}

vec4 collide(Line l, Ball c) {
  float doCollide = fsquare(2.0 * dot(l.pos - c.pos, l.dir)) - 4.0 * dot(l.dir, l.dir) * (dot(l.pos - c.pos, l.pos - c.pos) - fsquare(c.r));
  return vec4(c.col, doCollide);
}

CollisionT collision(Line l, Ball c) {
  float sqrtD = sqrt(collide(l, c).a)/(2.*dot(l.dir, l.dir));
  float inter = (-(2. * dot(l.pos - c.pos, l.dir)))/(2.*dot(l.dir, l.dir));
  float cp1 = inter + sqrtD;
  float cp2 = inter - sqrtD;
  return CollisionT(cp1, cp2);
}

vec3 checklightpoint(vec3 origin, Ball c, vec3 lightpoint) {
  Line l = Line(origin, normalize(lightpoint - origin));
  CollisionT col = collision(l, c);
  vec3 normal = normalize(origin - c.pos);
  float t = (col.t1 == 0.) ? col.t2 : col.t1;
  return vec3((max(0., dot(l.dir, normal)) + 0.1)*c.col);
}

void main() {
  vec2 uv = vTexCoord*2. - 1.;
  Line l = Line(vec3(0.), vec3(uv, 1.));
  Ball c = Ball(vec3(sin(t), cos(t), sin(t)+4.), vec3(1., 0., 1.), 1.);
  CollisionT col = collision(l, c);
  if (collide(l, c).a > 0.) {
  float t = min(col.t1, col.t2);
  vec3 p = l.pos + l.dir*t;
  vec3 color = checklightpoint(p, c, vec3(1., 3., 2.));
  gl_FragColor = vec4(color, 1.);
  } else {
    gl_FragColor = vec4(0., 0., 0., 1.);
  }
}