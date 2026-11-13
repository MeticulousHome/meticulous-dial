// The trail's pixels on the band trail.vert draws: both radial edges antialiased, the colour faded from 0
// at the tip to 1 at the head (stop-opacity 0 -> 1, padded).
// Baked with: qsb --glsl "100 es,120,150" -o trail.frag.qsb trail.frag
#version 440
layout(location = 0) in float vRadius;
layout(location = 1) in float vInner;
layout(location = 2) in float vGrad;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float delta;
    float inner;
    float outer;
    float center;
};

void main() {
    float cover = clamp(outer + 0.5 - vRadius, 0.0, 1.0) * clamp(vRadius - vInner + 0.5, 0.0, 1.0);
    fragColor = color * (cover * clamp(vGrad, 0.0, 1.0) * qt_Opacity);
}
