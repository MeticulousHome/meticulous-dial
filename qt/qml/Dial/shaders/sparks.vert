// The sparks of SparkRing.qml, all of them moved here: no script runs per frame and one draw call draws them.
// Each spark is a kite of 3 columns of the GridMesh (tail, widest point, head). The first and last columns are
// collapsed to a point, so the strip of mesh that joins one spark to the next has no area and draws nothing.
// A spark lives `life` seconds and is born again with new random values each cycle, and it shows only if it
// was born while the ring burned: in the burn that is on or was last (w1Start..w1Stop) or in the one before
// it (w0Start..w0Stop), so a press starts with an empty sky, a let-go lets the sparks in the air finish and a
// second press leaves them there. Some leave the tip of the fill, the others any point of the part that was
// filled, as the fill stood when the spark was born, so nothing in the air moves when the ring winds back
// or fills again. Once the fill is done there is no tip and they all leave any point of the ring.
// style 0, sparks: they whirl clockwise, slow down, drift off the ring and fall a little. The tail is where
// the head was a moment ago, so it follows the curve. White hot, then orange, then a dull red.
// style 1, sparkles: two slots of the mesh cross into a four-point star that stays near the ring, grows,
// turns a little and shrinks again. Its colour is its place on the ring, and the rainbow turns with time.
// Baked with: qsb --glsl "100 es,120,150" -o sparks.vert.qsb sparks.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out vec3 vGlow;
layout(location = 1) out float vAcross;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;
    float now;          // SparkRing's probe of the clock: not read here
    float clockFrom;
    float w1Start;
    float w1Stop;
    float w1FillFrom;
    float w0Start;
    float w0Stop;
    float w0FillFrom;
    float fillSeconds;
    float radius;
    float side;
    float count;
    float style;
};
out gl_PerVertex { vec4 gl_Position; };

const float TAU = 6.2831853;
const float TRAIL_SECONDS = 0.085;

float rand(float x) { return fract(sin(x * 12.9898) * 43758.5453); }

// Where a spark is at `s` (0..1 of its life). 6 o'clock is angle 0, angles grow clockwise.
vec2 sparkAt(float s, float life, float angle, float spin, float ringRadius, float drift, float fall) {
    float a = angle + spin * life * (s - 0.38 * s * s);
    float r = ringRadius - drift * s;
    float seconds = s * life;
    return vec2(side * 0.5) + r * vec2(-sin(a), cos(a)) + vec2(0.0, fall * seconds * seconds);
}

vec3 rainbow(float hue) {
    return clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
    float column = floor(qt_MultiTexCoord0.x * (3.0 * count - 1.0) + 0.5);
    float slot = floor(column / 3.0 + 0.01);
    float part = column - 3.0 * slot;
    bool sparkles = style > 0.5;
    // A sparkle takes two slots, one for each of its two crossed arms.
    float spark = sparkles ? floor(slot * 0.5 + 0.01) : slot;
    float arm = slot - 2.0 * floor(slot * 0.5 + 0.01);

    float life = mix(0.32, 0.85, rand(spark + 0.37));
    float offset = rand(spark + 0.71);
    float cycles = time / life + offset;
    float s = fract(cycles);
    float seed = spark * 7.13 + floor(cycles) * 3.77;
    float born = (floor(cycles) - offset) * life;

    bool inLast = born >= w1Start && born <= w1Stop;
    bool inEarlier = born >= w0Start && born <= w0Stop;
    float burnStart = inLast ? w1Start : w0Start;
    float fillFrom = inLast ? w1FillFrom : w0FillFrom;

    // The ring's fill when this spark was born: from fillFrom to all of it, in fillSeconds. The power is
    // close enough to the ring's CSS ease-out (cubic-bezier 0, 0, 0.58, 1) for sparks that spray anyway.
    float progress = clamp((born - burnStart) / fillSeconds, 0.0, 1.0);
    float filled = TAU * mix(fillFrom, 1.0, 1.0 - pow(1.0 - progress, 1.7));
    bool atTip = progress < 1.0 && rand(spark * 0.5) < 0.3;
    float angle = atTip ? filled - rand(seed + 1.0) * 0.6 : rand(seed + 1.0) * TAU;
    // Nothing while `time` is not this clock's yet: the render thread starts it some frames after the
    // burn's own values arrive, and until then it is the time the clock stopped at (see SparkRing.qml).
    bool clockOn = time >= clockFrom && time <= clockFrom + 120.0;
    bool alive = clockOn && (inLast || inEarlier) && angle >= 0.0 && angle <= filled;

    vec2 head;
    vec2 tail;
    float width;
    float middle;
    vec3 glow;
    float tailFade = 0.0;
    float headFade = 0.9;
    if (sparkles) {
        // Most of them on the ring, some a little inside it; they float a short way along it.
        float inset = -5.0 + 50.0 * pow(rand(seed + 3.0), 2.2);
        float a = angle + 0.22 * s * (rand(seed + 2.0) - 0.3);
        vec2 center = vec2(side * 0.5) + (radius - inset - 8.0 * s) * vec2(-sin(a), cos(a));
        float swell = pow(sin(3.14159265 * s), 0.7);
        float reach = mix(7.0, 20.0, rand(seed + 6.0)) * swell;
        float turn = rand(seed + 4.0) * TAU + 0.9 * s + arm * 1.5707963;
        vec2 along = vec2(cos(turn), sin(turn));
        tail = center - along * reach;
        head = center + along * reach;
        width = max(reach * 0.24, 1.2);
        middle = 0.5;
        headFade = 0.0;
        float hue = fract(angle / TAU + time * 0.12 + 0.08 * rand(seed + 5.0));
        float twinkle = 0.75 + 0.25 * sin(time * 31.0 + seed);
        glow = 1.5 * mix(rainbow(hue), vec3(1.0), 0.22) * swell * twinkle;
    } else {
        float kick = rand(seed + 2.0);
        float spin = mix(2.2, 6.0, kick);
        float ringRadius = radius + (rand(seed + 3.0) - 0.5) * 9.0;
        float d = rand(seed + 4.0);
        float drift = 6.0 + 120.0 * d * d * d;
        float fall = 150.0 * rand(seed + 5.0);
        head = sparkAt(s, life, angle, spin, ringRadius, drift, fall);
        tail = sparkAt(max(s - TRAIL_SECONDS / life, 0.0), life, angle, spin, ringRadius, drift, fall);
        width = mix(2.6, 6.0, rand(seed + 6.0)) * (1.0 - 0.5 * s);
        middle = 0.68;
        // White hot at birth, then orange, then a dull red as it dies.
        vec3 hot = vec3(1.0, 0.93, 0.70);
        vec3 orange = vec3(1.0, 0.50, 0.08);
        vec3 ember = vec3(0.72, 0.14, 0.02);
        vec3 heat = s < 0.32 ? mix(hot, orange, s / 0.32) : mix(orange, ember, (s - 0.32) / 0.68);
        float flicker = 0.72 + 0.28 * sin(time * 47.0 + seed);
        glow = 1.7 * heat * min(s * 12.0, 1.0) * (1.0 - s * s) * flicker;
    }

    vec2 along = head - tail;
    float len = length(along);
    vec2 normal = len > 0.001 ? vec2(-along.y, along.x) / len : vec2(0.0);
    float across = qt_MultiTexCoord0.y * 2.0 - 1.0;

    vec2 p = head;
    vAcross = 0.0;
    float tipFade = headFade;
    if (part < 0.5) {
        p = tail;
        tipFade = tailFade;
    } else if (part < 1.5) {
        p = mix(tail, head, middle) + normal * across * width * 0.5;
        vAcross = across;
        tipFade = 1.0;
    }
    if (!alive)
        p = vec2(side * 0.5);

    vGlow = glow * tipFade * qt_Opacity;
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
