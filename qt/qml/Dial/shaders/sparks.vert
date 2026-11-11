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
// turns a little and shrinks again. Its colour is its place on the ring, as on the rainbow ring under it
// (Arc's rainbow scheme, shaders/arc.vert), give or take a little.
// style 2, steam: round, faint puffs that leave the ring a little inside it, rise, sway, grow and fade.
// Some are large and slow and overlap into a haze; more of them are small, brighter and quick, the billows
// in it. A puff is the kite as a square on its corner, and sparks.frag draws the round, soft blob that fits
// in it.
// style 3, drops: thick drips of coffee, two slots each: a round bead and the strand that holds it. The bead
// swells on the ring and sinks slowly while the strand stretches from the ring to it; then the strand breaks,
// runs into the bead, and the drop falls. At `letGo` (the profile starts) every drip that still hangs
// breaks, within a moment of the others: the pour.
// lifeScale makes every life longer (the steam's wisps and the drops' fall).
// Baked with: qsb --glsl "100 es,120,150" -o sparks.vert.qsb sparks.vert
#version 440
layout(location = 0) in vec4 qt_Vertex;
layout(location = 1) in vec2 qt_MultiTexCoord0;
layout(location = 0) out vec3 vGlow;
layout(location = 1) out float vAcross;
layout(location = 2) out float vAlong;
layout(location = 3) out float vRound;     // 0 a kite, 1 a soft puff, 2 a bead with a crisp edge
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
    float lifeScale;
    float letGo;
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

// A wisp of steam at `s`, from `base` on the ring: up, swaying a little.
vec2 steamAt(float s, vec2 base, float rise, float sway, float seed) {
    return base + vec2(sway * 20.0 * s + 9.0 * sin(s * 5.0 + seed) * s, -rise * s);
}

vec3 rainbow(float hue) {
    return clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
    float column = floor(qt_MultiTexCoord0.x * (3.0 * count - 1.0) + 0.5);
    float slot = floor(column / 3.0 + 0.01);
    float part = column - 3.0 * slot;
    bool sparkles = style > 0.5 && style < 1.5;
    bool steam = style > 1.5 && style < 2.5;
    bool drops = style > 2.5;
    // A sparkle takes two slots, one for each of its two crossed arms; a drip, one for its strand and one
    // for its bead.
    float spark = sparkles || drops ? floor(slot * 0.5 + 0.01) : slot;
    float arm = slot - 2.0 * floor(slot * 0.5 + 0.01);

    float life = mix(0.32, 0.85, rand(spark + 0.37)) * lifeScale;
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
    bool atTip = progress < 1.0 && rand(spark * 0.5) < (drops ? 0.45 : steam ? 0.4 : 0.3);
    float angle = atTip ? filled - rand(seed + 1.0) * 0.6 : rand(seed + 1.0) * TAU;
    // Nothing while `time` is not this clock's yet: the render thread starts it some frames after the
    // burn's own values arrive, and until then it is the time the clock stopped at (see SparkRing.qml).
    bool clockOn = time >= clockFrom && time <= clockFrom + 120.0;
    // Steam and drops use few of the slots: a field of them would be a fog or a downpour.
    bool used = rand(seed + 9.0) < (steam ? 0.38 : drops ? 0.42 : 1.0);
    bool alive = clockOn && used && (inLast || inEarlier) && angle >= 0.0 && angle <= filled;

    vec2 head;
    vec2 tail;
    float width;
    float middle;
    vec3 glow;
    float tailFade = 0.0;
    float headFade = 0.9;
    float shape = 0.0;
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
        float hue = fract(angle / TAU + 0.1 * (rand(seed + 5.0) - 0.5) + 1.0);
        float twinkle = 0.75 + 0.25 * sin(time * 31.0 + seed);
        glow = 1.5 * mix(rainbow(hue), vec3(1.0), 0.22) * swell * twinkle;
    } else if (steam) {
        vec2 base = vec2(side * 0.5) + (radius - 8.0 - 36.0 * rand(seed + 3.0)) * vec2(-sin(angle), cos(angle));
        // The haze, or one of the billows in it.
        bool billow = rand(seed + 8.0) < 0.6;
        float rise = billow ? mix(70.0, 150.0, rand(seed + 2.0)) : mix(35.0, 80.0, rand(seed + 2.0));
        float sway = rand(seed + 4.0) * 2.0 - 1.0;
        vec2 center = steamAt(s, base, rise, sway, seed);
        // Half the square's diagonal: the blob drawn in it is 0.7 of this wide.
        float reach = (billow ? mix(26.0, 46.0, rand(seed + 6.0)) : mix(52.0, 92.0, rand(seed + 6.0)))
                      * (0.55 + 0.75 * s);
        tail = center - vec2(0.0, reach);
        head = center + vec2(0.0, reach);
        width = 2.0 * reach;
        middle = 0.5;
        tailFade = 1.0;
        headFade = 1.0;
        shape = 1.0;
        glow = vec3(0.90, 0.90, 0.86) * (billow ? 0.14 : 0.085) * pow(sin(3.14159265 * s), 0.8);
    } else if (drops) {
        vec2 base = vec2(side * 0.5) + (radius - 1.0 - 3.0 * rand(seed + 3.0)) * vec2(-sin(angle), cos(angle));
        // It hangs and stretches for this much of its life, then the strand breaks and it falls.
        float hang = 0.6;
        // When its strand breaks: by itself, or with all the others when the profile starts.
        float breaks = born + hang * life;
        if (born <= letGo && breaks > letGo)
            breaks = letGo + 0.12 * rand(seed + 7.0);
        float stretch = clamp((min(time, breaks) - born) / (hang * life), 0.0, 1.0);
        float falling = max(time - breaks, 0.0);
        float reach = mix(22.0, 58.0, rand(seed + 2.0));
        float hung = reach * stretch * stretch;
        float sink = hung + 520.0 * falling * falling;
        vec2 bead = base + vec2(0.0, sink);
        float size = mix(5.0, 8.5, rand(seed + 6.0)) * (0.45 + 0.55 * stretch);
        // Coffee, not a light: the strand and the bead in one colour, the bead a little brighter.
        vec3 coffee = mix(vec3(0.80, 0.47, 0.17), vec3(0.58, 0.30, 0.10), rand(seed + 5.0));
        float shown = min(s * 10.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, s));
        if (arm < 0.5) {
            // The strand, from the ring to the bead; once broken, what is left of it runs into the bead.
            float left = time < breaks ? sink : hung * max(1.0 - falling / 0.16, 0.0);
            tail = bead - vec2(0.0, left);
            head = bead;
            width = size * 1.9;
            middle = 0.8;
            headFade = 1.0;
            glow = coffee * 0.85 * shown;
        } else {
            float reachOut = size * 1.4142;
            tail = bead - vec2(0.0, reachOut);
            head = bead + vec2(0.0, reachOut);
            width = 2.0 * reachOut;
            middle = 0.5;
            tailFade = 1.0;
            headFade = 1.0;
            shape = 2.0;
            glow = coffee * shown;
        }
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
    vAlong = 1.0;
    vRound = shape;
    float tipFade = headFade;
    if (part < 0.5) {
        p = tail;
        vAlong = -1.0;
        tipFade = tailFade;
    } else if (part < 1.5) {
        p = mix(tail, head, middle) + normal * across * width * 0.5;
        vAcross = across;
        vAlong = 0.0;
        tipFade = 1.0;
    }
    if (!alive)
        p = vec2(side * 0.5);

    vGlow = glow * tipFade * qt_Opacity;
    gl_Position = qt_Matrix * vec4(p, 0.0, 1.0);
}
