// Bends Arc.qml's GridMesh (128 x 1) into the ring band: x along the circle from 6 o'clock clockwise, y across
// the stroke plus a pixel each side for the antialiasing (and `glow` more each side). Only the band gets
// drawn, and each pixel gets its radius and angle without sqrt or atan: the Nano's GPU is short of per-pixel
// arithmetic at 120 Hz.
// The colour is worked out here too, per vertex, which the 128 columns follow closely. `scheme`: 0 `color`;
// 1 the colours of the rainbow once around the circle (red at 6 o'clock); 2 heat, from the purple of the
// heating bubbles to a hot orange, brighter at the end of the sweep; 3 crema, from dark coffee to gold, with
// the tiger stripes of an espresso's crema.
// Baked with: qsb --glsl "100 es,120,150" -o arc.vert.qsb arc.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out float vRadius;
layout(location = 1) out float vAngle;
layout(location = 2) out vec4 vColor;
layout(location = 3) out float vTip;
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
out gl_PerVertex { vec4 gl_Position; };

const float TAU = 6.2831853;

// The heating bubbles' gradient (BubbleAnimation.qml) from its purple on, and a hot end.
vec3 heat(float x) {
    vec3 c = mix(vec3(0.51, 0.13, 0.42), vec3(0.73, 0.22, 0.33), smoothstep(0.0, 0.3, x));
    c = mix(c, vec3(0.83, 0.28, 0.26), smoothstep(0.3, 0.5, x));
    c = mix(c, vec3(0.91, 0.38, 0.18), smoothstep(0.5, 0.7, x));
    c = mix(c, vec3(0.96, 0.30, 0.10), smoothstep(0.7, 0.85, x));
    return mix(c, vec3(1.0, 0.72, 0.42), smoothstep(0.85, 1.0, x));
}

void main() {
    float x = qt_MultiTexCoord0.x;
    float band = lineWidth * 0.5 + 1.0 + glow;
    vAngle = x * TAU;
    vRadius = radius - band + qt_MultiTexCoord0.y * 2.0 * band;
    vColor = color;
    vTip = 0.0;
    if (scheme > 0.5 && scheme < 1.5) {
        // The hues of shaders/sparks.vert's sparkles, which sit on this ring: the same place, the same colour.
        vec3 hue = clamp(abs(mod(x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        vColor = vec4(mix(hue, vec3(1.0), 0.22), 1.0) * color;
    } else if (scheme > 1.5 && scheme < 2.5) {
        vColor = vec4(heat(x), 1.0) * color;
        // How close to the end of the sweep, in pixels along the ring: the hot tip.
        float behind = (sweep * TAU - vAngle) * radius;
        vTip = behind >= -2.0 ? exp(-pow(max(behind, 0.0) / 34.0, 2.0)) : 0.0;
    } else if (scheme > 2.5) {
        vec3 crema = mix(vec3(0.40, 0.19, 0.07), vec3(0.96, 0.70, 0.36), smoothstep(0.0, 0.8, x));
        float stripes = 0.5 + 0.5 * sin(x * TAU * 11.0 + 2.0 * sin(x * TAU * 3.0));
        vColor = vec4(min(crema * mix(0.68, 1.15, stripes), vec3(1.0)), 1.0) * color;
    }
    vec2 p = vec2(side * 0.5) + vRadius * vec2(-sin(vAngle), cos(vAngle));
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
