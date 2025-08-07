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

float fsquare(float f) {
  return f*f;
}

vec4 collide(Line l, Ball c) {
  float doCollide = fsquare(2.0 * dot(l.pos - c.pos, l.dir)) - 4.0 * dot(l.dir, l.dir) * (dot(l.pos - c.pos, l.pos - c.pos) - fsquare(c.r));
  return vec4(c.col, doCollide);
}

void main() {
  vec2 uv = vTexCoord*2. - 1.;
  Line l = Line(vec3(0.), vec3(uv, 1.));
  Ball c = Ball(vec3(sin(t), cos(t), sin(t)+4.), vec3(1., 0., 1.), 1.);
  vec4 col = collide(l, c);
  col.a = col.a > 0.0 ? 1.0 : 0.0;
  col.rgb = col.rgb*col.a;
  gl_FragColor = col;
}