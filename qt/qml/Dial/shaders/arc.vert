// Bends Arc.qml's GridMesh (128 x 1) into the ring band: x along the circle from 6 o'clock clockwise, y across
// the stroke plus a pixel each side for the antialiasing. Only the band gets drawn, and each pixel gets its
// radius and angle without sqrt or atan: the Nano's GPU is short of per-pixel arithmetic at 120 Hz.
// The colour is worked out here too, per vertex: `color`, or with `rainbow` the colours of the rainbow once
// around the circle (red at 6 o'clock), which the 128 columns follow closely.
// Baked with: qsb --glsl "100 es,120,150" -o arc.vert.qsb arc.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out float vRadius;
layout(location = 1) out float vAngle;
layout(location = 2) out vec4 vColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float sweep;
    float radius;
    float lineWidth;
    float side;
    float rainbow;
};
out gl_PerVertex { vec4 gl_Position; };

void main() {
    float band = lineWidth * 0.5 + 1.0;
    vAngle = qt_MultiTexCoord0.x * 6.2831853;
    vRadius = radius - band + qt_MultiTexCoord0.y * 2.0 * band;
    vColor = color;
    if (rainbow > 0.5) {
        // The hues of shaders/sparks.vert's sparkles, which sit on this ring: the same place, the same colour.
        vec3 hue = clamp(abs(mod(qt_MultiTexCoord0.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        vColor = vec4(mix(hue, vec3(1.0), 0.22), 1.0) * color;
    }
    vec2 p = vec2(side * 0.5) + vRadius * vec2(-sin(vAngle), cos(vAngle));
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
