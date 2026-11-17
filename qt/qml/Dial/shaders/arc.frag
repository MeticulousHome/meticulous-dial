// The arc's pixels, on the band arc.vert draws: the stroke's edges antialiased from the radius, the end
// from the arc length past `sweep` (the start is the band's own edge, at 6 o'clock).
// Baked with: qsb --glsl "100 es,120,150" -o arc.frag.qsb arc.frag
#version 440
layout(location = 0) in float vRadius;
layout(location = 1) in float vAngle;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float sweep;
    float radius;
    float lineWidth;
    float side;
};

void main() {
    float cover = clamp(lineWidth * 0.5 + 0.5 - abs(vRadius - radius), 0.0, 1.0);
    cover *= clamp((sweep * 6.2831853 - vAngle) * radius + 0.5, 0.0, 1.0);
    fragColor = color * (cover * qt_Opacity);
}
