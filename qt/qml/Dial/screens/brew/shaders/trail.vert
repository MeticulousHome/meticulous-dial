// The manual target's trail (TargetTick.tsx + trailGeometry.ts): TrailArc.qml's GridMesh (N x 1) bent into
// the comet between the tick's radii, in the marker's frame: x runs from the tip (local angle -delta, on
// the outer radius) to the head (angle 0, the full 19 px from the inner to the outer radius), y across the
// band plus a pixel each side for the antialiasing. The fade runs along the straight chord from the tip
// to the head (the SVG linearGradient), which is affine in the position, so it is computed per vertex.
// Baked with: qsb --glsl "100 es,120,150" -o trail.vert.qsb trail.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out float vRadius;
layout(location = 1) out float vInner;
layout(location = 2) out float vGrad;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 color;
    float delta;
    float inner;
    float outer;
    float center;
};
out gl_PerVertex { vec4 gl_Position; };

void main() {
    float u = qt_MultiTexCoord0.x;
    float a = -delta * (1.0 - u);
    // The inner edge tapers linearly from the inner radius at the head to the outer radius at the tip.
    float rin = outer - (outer - inner) * u;
    float r = mix(rin - 1.0, outer + 1.0, qt_MultiTexCoord0.y);
    vec2 c = vec2(center, center);
    vec2 p = c + r * vec2(cos(a), sin(a));
    vec2 tip = c + outer * vec2(cos(-delta), sin(-delta));
    vec2 head = c + vec2(outer, 0.0);
    vec2 d = head - tip;
    vGrad = dot(p - tip, d) / max(dot(d, d), 0.000001);
    vRadius = r;
    vInner = rin;
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
