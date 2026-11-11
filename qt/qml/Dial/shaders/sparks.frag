// The sparks' pixels: soft across the kite, and added to what is under them (alpha 0 with premultiplied
// blending), so sparks that cross get brighter. All the colour comes from sparks.vert.
// Baked with: qsb --glsl "100 es,120,150" -o sparks.frag.qsb sparks.frag
#version 440
layout(location = 0) in vec3 vGlow;
layout(location = 1) in float vAcross;
layout(location = 0) out vec4 fragColor;

void main() {
    fragColor = vec4(vGlow * (1.0 - abs(vAcross)), 0.0);
}
