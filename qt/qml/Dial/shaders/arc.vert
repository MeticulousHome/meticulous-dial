// Bends Arc.qml's GridMesh (128 x 1) into the ring band: x along the circle from 6 o'clock clockwise, y across
// the stroke plus a pixel each side for the antialiasing. Only the band gets drawn, and each pixel gets its
// radius and angle without sqrt or atan: the Nano's GPU is short of per-pixel arithmetic at 120 Hz.
// Baked with: qsb --glsl "100 es,120,150" -o arc.vert.qsb arc.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out float vRadius;
layout(location = 1) out float vAngle;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float sweep;
    float radius;
    float lineWidth;
    float side;
};
out gl_PerVertex { vec4 gl_Position; };

void main() {
    float band = lineWidth * 0.5 + 1.0;
    vAngle = qt_MultiTexCoord0.x * 6.2831853;
    vRadius = radius - band + qt_MultiTexCoord0.y * 2.0 * band;
    vec2 p = vec2(side * 0.5) + vRadius * vec2(-sin(vAngle), cos(vAngle));
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
