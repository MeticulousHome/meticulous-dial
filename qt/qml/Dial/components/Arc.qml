// An antialiased circular arc (what the React Dial draws as an SVG circle with a dash or a CSS border).
// It starts at 6 o'clock plus startAngle (degrees, clockwise) and runs clockwise for `sweep` of the circle.
// A ShaderEffect whose mesh is bent into the ring band (shaders/arc.vert), so only the band's pixels are
// drawn: Qt5Compat masks render offscreen on every change, and a shader over the whole square costs more
// per-pixel arithmetic than the i.MX8M Nano's GPU has (measured with the Qt prototype, 2026-10-23).
import QtQuick

Item {
    id: arc
    property real radius: 100          // to the middle of the stroke
    property real lineWidth: 3
    property color color: "white"
    property real sweep: 1             // 0..1 of the circle
    property real startAngle: 0        // degrees clockwise from 6 o'clock

    implicitWidth: 2 * radius + lineWidth
    implicitHeight: implicitWidth

    ShaderEffect {
        anchors.centerIn: parent
        width: 2 * arc.radius + arc.lineWidth
        height: width
        rotation: arc.startAngle
        visible: arc.sweep > 0 && arc.opacity > 0
        mesh: GridMesh { resolution: Qt.size(128, 1) }
        // Uniforms of shaders/arc.vert and arc.frag, by name.
        property color color: arc.color
        // A full circle ends past 1, so its end doesn't fade where it meets the start.
        property real sweep: arc.sweep >= 1 ? 2 : arc.sweep
        property real radius: arc.radius
        property real lineWidth: arc.lineWidth
        property real side: width
        vertexShader: "../shaders/arc.vert.qsb"
        fragmentShader: "../shaders/arc.frag.qsb"
    }
}
