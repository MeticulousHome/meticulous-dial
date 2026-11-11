// The sparks' pixels, added to what is under them (alpha 0 with premultiplied blending), so sparks that
// cross get brighter. All the colour comes from sparks.vert. A kite is soft across it. A puff or a bead is
// the round blob that fits in a kite drawn as a square on its corner: vAcross and vAlong are its two
// diagonals, so their squares add up to 0.5 on its sides, and the blob ends there. A puff fades all the way
// from its middle, a bead only at its edge.
// Baked with: qsb --glsl "100 es,120,150" -o sparks.frag.qsb sparks.frag
#version 440
layout(location = 0) in vec3 vGlow;
layout(location = 1) in float vAcross;
layout(location = 2) in float vAlong;
layout(location = 3) in float vRound;
layout(location = 0) out vec4 fragColor;

void main() {
    float shade = 1.0 - abs(vAcross);
    if (vRound > 0.5) {
        float inside = max(1.0 - 2.0 * (vAcross * vAcross + vAlong * vAlong), 0.0);
        shade = vRound > 1.5 ? min(inside * 3.0, 1.0) : inside * inside;
    }
    fragColor = vec4(vGlow * shade, 0.0);
}
