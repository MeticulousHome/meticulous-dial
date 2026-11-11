// The arc's pixels, on the band arc.vert draws: the stroke's edges antialiased from the radius, the end
// from the arc length past `sweep` (the start is the band's own edge, at 6 o'clock). With `glow`, a soft halo
// that far each side of the stroke, stronger at the hot tip of the heat scheme.
// Baked with: qsb --glsl "100 es,120,150" -o arc.frag.qsb arc.frag
#version 440
layout(location = 0) in float vRadius;
layout(location = 1) in float vAngle;
layout(location = 2) in vec4 vColor;
layout(location = 3) in float vTip;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float sweep;
    float radius;
    float lineWidth;
    float side;
    float scheme;
    float glow;
};

void main() {
    float d = abs(vRadius - radius);
    float cover = clamp(lineWidth * 0.5 + 0.5 - d, 0.0, 1.0);
    if (glow > 0.0) {
        float h = 1.0 - clamp((d - lineWidth * 0.5) / glow, 0.0, 1.0);
        cover = max(cover, h * h * (0.3 + 0.6 * vTip));
    }
    cover *= clamp((sweep * 6.2831853 - vAngle) * radius + 0.5, 0.0, 1.0);
    vec4 c = vec4(min(vColor.rgb * (1.0 + 0.8 * vTip), vec3(1.0)), vColor.a);
    fragColor = c * (cover * qt_Opacity);
}
