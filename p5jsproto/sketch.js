let simpleShader;
let texture;

function preload() {
  simpleShader = loadShader("shader.vert", "shader.frag");
  
  
}

function setup() {
  createCanvas(480, 480, WEBGL);
  noStroke();
}
function draw() {
  shader(simpleShader);
  clear();
  t = millis() / 1000
  simpleShader.setUniform("t", t);
  simpleShader.setUniform("wsize", [width, height]);

  // rect gives us some geometry on the screen
  rect(0, 0, width, height);

}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

}
