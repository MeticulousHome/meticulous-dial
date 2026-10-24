// The last pour-over (src/features/freePour/FreePourHistoryScreen.tsx, free-pour-history.css): its name,
// dose, temperature and water, the weight (cream) and flow (blue, 0-10 g/s) over the brew with the pours as
// dots on the axis, and a yellow cursor the knob moves 5 s at a time with the pour, time, water and flow
// under it. A push or a double press goes home. "No free pour history" when there is none.
import QtQuick
import Dial
import Dial.Native
import "Css.js" as Css
import "Format.js" as Format
import "Logging.js" as Log

Item {
    id: history
    anchors.fill: parent
    property bool transitioning: false

    readonly property int chartLeft: 68
    readonly property int chartTop: 108
    readonly property int chartWidth: 344
    readonly property int chartHeight: 142
    readonly property int scrollStepMs: 5000
    readonly property int maxChartSamples: 1200

    property var session: undefined             // undefined while loading, then a FreePourSession or null
    property real selectedTimeMs: 0
    property bool _alive: true

    readonly property real durationMs: session ? session.measurements.durationMs : 0
    readonly property var plottedSamples: {
        const source = session && session.samples ? session.samples : []
        if (source.length <= maxChartSamples) return source
        const stride = Math.ceil(source.length / maxChartSamples)
        return source.filter((sample, index) => index % stride === 0 || index === source.length - 1)
    }
    readonly property real maxWeight: plottedSamples.reduce((maximum, sample) => Math.max(maximum, sample.w), 1)
    readonly property bool hasChart: !!session && plottedSamples.length > 0 && session.samples.length > 0
    readonly property var selected: hasChart ? closestSample(session.samples, selectedTimeMs) : null
    readonly property real cursorX: chartLeft + (selectedTimeMs / Math.max(1, durationMs)) * chartWidth
    readonly property int selectedPour: {
        if (!selected) return 1
        if (selected.p) return selected.p
        const pours = session.pours.slice().reverse()
        const pour = pours.find(p => p.startTimeMs <= selectedTimeMs)
        return (pour && pour.number) || 1
    }

    readonly property string dialProbe_historyState: session === undefined ? "loading" : hasChart ? "chart" : "empty"
    readonly property real dialProbe_historySelectedMs: selectedTimeMs

    function closestSample(samples, timeMs) {
        return samples.reduce((closest, sample) => Math.abs(sample.t - timeMs) < Math.abs(closest.t - timeMs) ? sample : closest)
    }
    function flat(value, maximum) {
        const out = []
        for (const sample of plottedSamples) out.push(sample.t, Format.clamp(value(sample), 0, maximum))
        return out
    }

    Component.onCompleted: {
        FreePourStorage.getLatestFreePourSession().then(latest => {
            if (history._alive) history.session = latest
        }).catch(error => {
            Log.logFreePourError("history_read_failed", error)
            if (history._alive) history.session = null
        })
    }
    Component.onDestruction: _alive = false

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: history.selectedTimeMs = Math.max(0, history.selectedTimeMs - history.scrollStepMs)
        onTurnRight: history.selectedTimeMs = Math.min(history.durationMs, history.selectedTimeMs + history.scrollStepMs)
        onClick: {
            Log.logFreePour("history_closed", { source: "click" })
            Nav.setScreen("profileHome")
        }
        onDoubleClick: {
            Log.logFreePour("history_closed", { source: "double_press" })
            Nav.setScreen("profileHome")
        }
    }

    LoadingScreen {
        visible: history.session === undefined
    }

    // .free-pour-history--empty
    Item {
        anchors.fill: parent
        visible: history.session !== undefined && !history.hasChart
        readonly property var tops: Css.flexColumnTops(480, [[0, 24 * Css.DIATYPE_NORMAL], [22, 14 * Css.DIATYPE_NORMAL]])
        FpText {
            y: parent.tops[0]
            cssWeight: 700
            font.pixelSize: 24
            font.letterSpacing: 2
            text: "NO FREE POUR HISTORY"
        }
        FpText {
            y: parent.tops[1]
            font.pixelSize: 14
            font.letterSpacing: 1.5
            color: "#8d9694"
            text: "PRESS DIAL TO RETURN"
        }
    }

    Item {
        id: chartView
        anchors.fill: parent
        visible: history.hasChart

        FpText {
            y: 35
            cssWeight: 650
            font.pixelSize: 22
            font.letterSpacing: 2
            text: history.session ? String(history.session.recipe.profileName).toUpperCase() : ""
        }
        FpText {
            y: 67
            mono: true
            font.pixelSize: 12
            font.letterSpacing: 1.5
            color: "#8d9694"
            text: {
                const s = history.session
                if (!s) return ""
                const m = s.measurements
                const temperature = m.waterTemperatureC !== null && m.waterTemperatureC !== undefined ? m.waterTemperatureC
                                  : s.recipe.temperatureC !== null && s.recipe.temperatureC !== undefined ? s.recipe.temperatureC : 92
                return s.recipe.doseG + "g · " + temperature + "°C · " + Math.round(m.waterPouredG) + "g WATER"
            }
        }

        // the chart (an SVG 480 x 284 at the top-left in React), in its drawing order
        Rectangle {
            x: history.chartLeft
            y: history.chartTop + history.chartHeight - 1
            width: history.chartWidth
            height: 2
            color: "#596460"
        }
        Repeater {
            model: [0, 0.5, 1]
            PlotLine {
                required property real modelData
                x: history.chartLeft
                y: history.chartTop + history.chartHeight * modelData - 0.5
                width: history.chartWidth
                height: 1
                points: [Qt.point(0, 0.5), Qt.point(1, 0.5)]
                color: "#26312f"
                lineWidth: 1
                dash: 3
                gap: 7
            }
        }
        Repeater {
            model: history.session && history.hasChart ? history.session.pours.length : 0
            Rectangle {
                required property int index
                readonly property real cx: history.chartLeft + (history.session.pours[index].startTimeMs / Math.max(1, history.durationMs)) * history.chartWidth
                x: cx - 4
                y: history.chartTop + history.chartHeight - 4
                width: 8
                height: 8
                radius: 4
                antialiasing: true
                color: "#e7e3da"
            }
        }
        PlotLine {
            id: weightLine
            x: history.chartLeft
            y: history.chartTop
            width: history.chartWidth
            height: history.chartHeight
            xMin: 0
            xMax: Math.max(1, history.durationMs)
            yMin: 0
            yMax: history.maxWeight
            color: "#e7e3da"
            lineWidth: 2.5
        }
        PlotLine {
            id: flowLine
            x: history.chartLeft
            y: history.chartTop
            width: history.chartWidth
            height: history.chartHeight
            xMin: 0
            xMax: Math.max(1, history.durationMs)
            yMin: 0
            yMax: 10
            color: "#78d6ff"
            lineWidth: 2.5
        }
        Rectangle {
            x: history.cursorX - 1
            y: history.chartTop - 5
            width: 2
            height: history.chartHeight + 10
            color: "#f5c444"
        }

        // .free-pour-history-values: four 81.5 px columns from x 65, 8 px apart
        Repeater {
            model: 4
            Item {
                required property int index
                x: 65 + index * (81.5 + 8)
                y: 277
                width: 81.5
                height: 11 * Css.DIATYPE_NORMAL + 5 + 20
                FpText {
                    font.pixelSize: 11
                    font.letterSpacing: 1.5
                    color: "#8d9694"
                    text: ["POUR", "TIME", "WATER", "FLOW"][parent.index]
                }
                FpText {
                    y: 11 * Css.DIATYPE_NORMAL + 5
                    mono: true
                    font.pixelSize: 20
                    lineHeightPx: 20
                    text: {
                        const s = history.selected
                        if (!s) return ""
                        switch (parent.index) {
                        case 0: return String(history.selectedPour)
                        case 1: return Format.formatBrewTime(history.selectedTimeMs)
                        case 2: return Math.round(s.w) + "g"
                        }
                        return Math.round(s.f) + " g/s"
                    }
                }
            }
        }
        FpText {
            y: 358
            cssWeight: 650
            font.pixelSize: 15
            font.letterSpacing: 2
            text: "TURN DIAL · 5 SEC"
        }
        // .free-pour-history-legend: centered, 24 px between the two, a 16 x 3 swatch 7 px before each label
        Row {
            y: 391
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 24
            Repeater {
                model: [["WEIGHT", "#e7e3da"], ["FLOW", "#78d6ff"]]
                Row {
                    required property var modelData
                    spacing: 7
                    height: 11 * Css.DIATYPE_NORMAL
                    Rectangle {
                        anchors.verticalCenter: parent.verticalCenter
                        width: 16
                        height: 3
                        radius: 1.5
                        antialiasing: true
                        color: parent.modelData[1]
                    }
                    FpText {
                        width: implicitWidth
                        font.pixelSize: 11
                        font.letterSpacing: 1.5
                        color: "#8d9694"
                        text: parent.modelData[0]
                    }
                }
            }
        }
    }

    onPlottedSamplesChanged: {
        weightLine.setFlat(flat(sample => sample.w, maxWeight))
        flowLine.setFlat(flat(sample => sample.f, 10))
    }
}
