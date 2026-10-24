// ShotGraph (src/components/ShotGraph/ShotGraphScreen.tsx, GraphAnnotations.tsx, GraphPath.ts): the last
// shot of a profile (POST /api/v1/history { ids: [id], dump_data, max_results: 1 }), flow, pressure and
// weight over time in a 270 x 175 px plot (0..12 bar and ml/s, 0..100 g) with dashed dividers, the axis
// across the screen, the shot's end weight and time, and a red selection the knob moves through the shot
// in 50 steps; under it the three values at the selection. The lines are PlotLines.
//
// The GraphContainer box is 480 x 500 (480 tall plus its 20 px padding-top): the content (the 220 px
// plot, 10 px, the labels) is centered under the padding.
import QtQuick
import Dial
import Dial.Native

Item {
    id: graph
    property var profile: null
    property bool isStatic: false

    width: 480
    height: 500

    readonly property int graphWidth: 270
    readonly property int graphHeight: 175
    readonly property int wrapperHeight: 220
    readonly property real hPadding: (480 - graphWidth) / 2
    readonly property real vPadding: (wrapperHeight - graphHeight) / 2
    readonly property color axisColor: "#00475B"
    // dataTypes (src/types/dataTypes.ts), in the order the paths are drawn and the labels listed.
    readonly property var types: [
        { key: "flow", min: 0, max: 12, color: Theme.dataBlueLight, precision: 1 },
        { key: "pressure", min: 0, max: 12, color: Theme.dataGreenLight, precision: 1 },
        { key: "weight", min: 0, max: 100, color: Theme.dataYellow, precision: 1 }
    ]

    property bool loading: false
    property var shot: undefined
    property int selectedIndex: 0
    readonly property var samples: shot ? shot.data : []
    readonly property int count: samples.length
    readonly property var selectedPoint: count ? samples[Math.min(selectedIndex, count - 1)] : null
    readonly property real startTime: count ? samples[0].time : 0
    readonly property real endTime: count ? samples[count - 1].time : 0
    readonly property int gestureProgress: shot ? Math.round(Math.max(0, count - 1) / 50) : 0

    // Test probes: whether the graph shows a shot, and what the selection reads.
    readonly property bool dialProbe_graphShown: count > 0 && !loading
    readonly property int dialProbe_graphCurves: count > 1 ? 3 : 0
    readonly property int dialProbe_selectedIndex: selectedIndex
    readonly property string dialProbe_selection: selectionTime.value + " " + labelValues.join(" ")
    readonly property var labelValues: types.map(t => ((selectedPoint && selectedPoint.shot[t.key]) || 0.0).toFixed(t.precision))

    // useHistoryShot(lastShotForProfileQuery(profile)): disabled without a profile.
    property int _request: 0
    function fetch() {
        shot = undefined
        selectedIndex = 0
        if (!profile || !profile.id) {
            loading = false
            return
        }
        const request = ++_request
        loading = true
        const query = { ids: [profile.id], dump_data: true, max_results: 1 }
        const attempt = (n) => Api.searchHistory(query).catch(error => {
            if (n >= 3) throw error
            return new Promise(resolve => {
                const t = Qt.createQmlObject("import QtQml; Timer { repeat: false }", graph)
                t.interval = Math.min(1000 * Math.pow(2, n), 30000)
                t.triggered.connect(() => { t.destroy(); resolve() })
                t.start()
            }).then(() => attempt(n + 1))
        })
        attempt(0).then(res => {
            if (request !== _request) return
            shot = res && res.history ? res.history[0] : undefined
            loading = false
        }).catch(error => {
            if (request !== _request) return
            console.error("History query failed:", error && error.message ? error.message : error)
            loading = false
        })
    }
    property string profileId: profile && profile.id ? profile.id : ""
    // Once per profile: at creation the profile may arrive after the first binding pass, and Qt.callLater
    // folds that change and onCompleted into one query.
    onProfileIdChanged: Qt.callLater(fetch)
    Component.onCompleted: Qt.callLater(fetch)

    GestureHandler {
        enabled: !(Nav.bubbleInterceptsGesture || graph.isStatic)
        onTurnLeft: graph.selectedIndex = Math.max(0, graph.selectedIndex - graph.gestureProgress)
        onTurnRight: graph.selectedIndex = Math.min(graph.selectedIndex + graph.gestureProgress, graph.count - 1)
    }

    LoadingScreen {
        visible: graph.loading
        width: 480
        height: 480
        y: 10
    }

    // "Not historicial shot available for this profile" (sic), centered in the container.
    Column {
        visible: !graph.loading && graph.shot === undefined
        anchors.horizontalCenter: parent.horizontalCenter
        y: 20 + (480 - height) / 2
        spacing: 10
        Repeater {
            model: ["Not historicial shot available for this profile", "Select a different one"]
            delegate: Text {
                required property string modelData
                anchors.horizontalCenter: parent.horizontalCenter
                height: 16
                verticalAlignment: Text.AlignVCenter
                text: modelData
                color: "white"
                font.family: Theme.fontRegular
                font.pixelSize: 16
            }
        }
    }

    // ---- the plot and the labels, centered under the padding
    Item {
        id: content
        visible: !graph.loading && graph.shot !== undefined
        width: 480
        height: graph.wrapperHeight + 10 + labels.height
        y: 20 + (480 - height) / 2

        // X axis across the screen: 3 px at the bottom of the plot
        Rectangle {
            y: graph.vPadding + graph.graphHeight - 1.5
            width: 480
            height: 3
            color: graph.axisColor
        }

        Item {
            id: plot
            x: graph.hPadding
            y: graph.vPadding
            width: graph.graphWidth
            height: graph.graphHeight

            // GraphDividers: 7 dashed lines (4, 8), 1 px #403F3F, to the right edge and beyond
            Repeater {
                model: 7
                delegate: PlotLine {
                    required property int index
                    y: index * graph.graphHeight / 6
                    width: 480 + graph.hPadding
                    height: 0
                    xMin: 0
                    xMax: 480 + graph.hPadding
                    points: [Qt.point(0, 0), Qt.point(480 + graph.hPadding, 0)]
                    color: Theme.gray3
                    lineWidth: 1
                    dash: 4
                    gap: 8
                }
            }

            // getGraphPath: x over the shot's time, y clamped to the type's range
            Repeater {
                model: graph.types.length
                delegate: PlotLine {
                    id: curve
                    required property int index
                    readonly property var type: graph.types[index]
                    anchors.fill: parent
                    xMin: 0
                    xMax: Math.max(graph.endTime - graph.startTime, 1)
                    yMin: type.min
                    yMax: type.max
                    color: type.color
                    lineWidth: 2
                    function rebuild() {
                        const flat = []
                        const d = graph.samples
                        for (let i = 0; i < d.length; i++) {
                            flat.push(d[i].time - graph.startTime)
                            flat.push(Math.min(type.max, Math.max(type.min, d[i].shot[type.key])))
                        }
                        setFlat(flat)
                    }
                    Connections {
                        target: graph
                        function onShotChanged() { curve.rebuild() }
                    }
                    Component.onCompleted: rebuild()
                }
            }

            // StartEndIndicator: dashed (4, 4) 2 px lines at both ends, the end weight above, the end time below
            Repeater {
                model: 2
                delegate: PlotLine {
                    required property int index
                    x: index * graph.graphWidth
                    width: 0
                    height: graph.graphHeight
                    xMin: 0
                    xMax: 1
                    yMin: 0
                    yMax: graph.graphHeight
                    points: [Qt.point(0, graph.graphHeight), Qt.point(0, 0)]
                    color: graph.axisColor
                    lineWidth: 2
                    dash: 4
                    gap: 4
                }
            }
            ValueText {
                x: graph.graphWidth + 5
                baselineY: -5
                value: ((graph.count ? graph.samples[graph.count - 1].shot.weight : 0) || 0.0).toFixed(1)
                unit: "g"
            }
            ValueText {
                x: graph.graphWidth + 5
                baselineY: graph.graphHeight + 20
                value: ((graph.count ? graph.samples[graph.count - 1].time : 0) / 1000 || 0.0).toFixed(1)
                unit: "s"
            }

            // SelectionIndicator
            Item {
                id: selection
                readonly property real selectedX: graph.count && graph.endTime > graph.startTime
                                                  ? (graph.selectedPoint.time - graph.startTime) * (graph.graphWidth / (graph.endTime - graph.startTime)) : 0
                readonly property real indexPercentage: graph.count ? graph.selectedIndex / graph.count : 0
                readonly property real fontDisplacement: Math.cos(indexPercentage * Math.PI)
                readonly property real fontCenter: fontDisplacement > 0 ? fontDisplacement * 20 : fontDisplacement * 35
                readonly property real leftAlpha: Math.round((indexPercentage === 0 ? 0 : indexPercentage < 0.1 ? indexPercentage / 0.1 : 1) * 255) / 255
                readonly property real rightAlpha: Math.round((indexPercentage > 0.9 ? (1 - indexPercentage) / 0.1 : 1) * 255) / 255

                ValueText {
                    id: selectionTime
                    anchorMiddle: true
                    x: selection.selectedX + 5 + selection.fontCenter
                    baselineY: -5
                    value: ((graph.selectedPoint ? graph.selectedPoint.time : 0) / 1000 || 0.0).toFixed(1)
                    unit: "s"
                }
                // 3 px brand red from the top to 5 px under the plot, round caps
                Rectangle {
                    x: selection.selectedX - 1.5
                    y: -1.5
                    width: 3
                    height: graph.graphHeight + 5 + 3
                    radius: 1.5
                    color: Theme.brandRed
                    antialiasing: true
                }
                Image {
                    x: selection.selectedX - 5 - 12
                    y: graph.graphHeight + 6
                    width: 12
                    height: 12
                    sourceSize: Qt.size(12, 12)
                    source: Theme.asset("icons/brew-graph-triangle-left.svg")
                    opacity: selection.leftAlpha
                }
                Image {
                    x: selection.selectedX + 5
                    y: graph.graphHeight + 6
                    width: 12
                    height: 12
                    sourceSize: Qt.size(12, 12)
                    source: Theme.asset("icons/brew-graph-triangle-right.svg")
                    opacity: selection.rightAlpha
                }
            }
        }

        // GraphLabels: flow, pressure, weight, 15 px apart, centered: the name (Mono 15 px, 3 px spacing,
        // upper case) over a 10 px colour square and the value (Mono 16 px), 5 px apart.
        Row {
            id: labels
            anchors.horizontalCenter: parent.horizontalCenter
            y: graph.wrapperHeight + 10
            spacing: 15
            Repeater {
                model: graph.types.length
                delegate: Column {
                    id: label
                    required property int index
                    spacing: 5
                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        height: 15
                        verticalAlignment: Text.AlignVCenter
                        text: graph.types[label.index].key
                        color: "#99e7e7e7"
                        font.family: Theme.fontMono
                        font.pixelSize: 15
                        font.letterSpacing: 3
                        font.capitalization: Font.AllUppercase
                    }
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        spacing: 5
                        Rectangle {
                            y: 3
                            width: 10
                            height: 10
                            color: graph.types[label.index].color
                        }
                        Text {
                            height: 16
                            verticalAlignment: Text.AlignVCenter
                            text: graph.labelValues[label.index]
                            color: "white"
                            font.family: Theme.fontMono
                            font.pixelSize: 16
                        }
                    }
                }
            }
        }
    }

    // valueText (GraphAnnotations.tsx): <text font-size 5> value (15 px #E7E7E7) ";" unit (15 px #E7E7E799)
    // ";" </text>: the stray semicolons are 5 px, in the default black fill: invisible, but they take room.
    component ValueText: Item {
        id: vt
        property string value
        property string unit
        property real baselineY: 0
        property bool anchorMiddle: false
        readonly property real semicolon: semi.advanceWidth
        readonly property real totalWidth: valueLabel.implicitWidth + semicolon + unitLabel.implicitWidth + semicolon
        TextMetrics {
            id: semi
            text: ";"
            font.family: Theme.fontMono
            font.pixelSize: 5
        }
        Text {
            id: valueLabel
            x: vt.anchorMiddle ? -vt.totalWidth / 2 : 0
            y: vt.baselineY - baselineOffset
            text: vt.value
            color: "#E7E7E7"
            font.family: Theme.fontMono
            font.pixelSize: 15
        }
        Text {
            id: unitLabel
            x: valueLabel.x + valueLabel.implicitWidth + vt.semicolon
            y: vt.baselineY - baselineOffset
            text: vt.unit
            color: "#99E7E7E7"
            font.family: Theme.fontMono
            font.pixelSize: 15
        }
    }
}
