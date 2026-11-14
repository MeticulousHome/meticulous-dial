// The comet behind the manual target tick (trailGeometry.ts, drawn in TargetTick.tsx as an SVG path with a
// linear gradient): between the tick's radii (204..223 px), from the tip at local angle -delta on the outer
// radius to the head at angle 0, where it is as wide as the painted tick; faded from transparent at the
// tip to `color` at the head. A shader on a mesh bent into the shape (shaders/trail.vert), like Arc:
// antialiased, and only the shape's pixels are drawn.
import QtQuick
import "BarometerLogic.js" as Geo

Item {
    id: trail
    property real delta: 0               // headAngle - tipAngle, radians, signed
    property color color: "white"

    width: Geo.ARC_SIZE
    height: Geo.ARC_SIZE

    ShaderEffect {
        anchors.fill: parent
        visible: trail.delta !== 0 && isFinite(trail.delta)
        mesh: GridMesh { resolution: Qt.size(64, 1) }
        property color color: trail.color
        property real delta: trail.delta
        property real inner: Geo.TARGET_TICK_INNER_RADIUS
        property real outer: Geo.TARGET_TICK_OUTER_RADIUS
        property real center: Geo.ARC_RADIUS
        vertexShader: "shaders/trail.vert.qsb"
        fragmentShader: "shaders/trail.frag.qsb"
    }
}
