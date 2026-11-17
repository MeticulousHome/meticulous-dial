pragma Singleton
// The machine's live state: the stats slice (src/components/store/features/stats/stats-slice.ts), fed by the
// socket.io "status", "sensors", "water_status" and "heater_status" events (Backend.qml).
import QtQuick

QtObject {
    id: stats

    // The last "status" event, as the backend sends it (ISensorDataAndMachineState):
    // { id, state, name, extracting, sensors: { p, f, w, t, g }, time, profile_time, profile, setpoints,
    //   loaded_profile, ... }
    property var status: ({
        id: "", state: "idle", name: "idle", extracting: false,
        sensors: { p: 0, f: 0, w: 0, t: 0, g: 0 },
        time: 0, profile_time: 0, profile: undefined, setpoints: ({}), loaded_profile: ""
    })

    readonly property string name: status && status.name !== undefined ? status.name : ""
    readonly property string machineState: status && status.state !== undefined ? status.state : ""
    readonly property bool extracting: !!(status && status.extracting)
    readonly property var sensors: (status && status.sensors) || ({ p: 0, f: 0, w: 0, t: 0, g: 0 })
    readonly property real time: status && status.time !== undefined ? status.time : 0
    readonly property real profileTime: status && status.profile_time !== undefined ? status.profile_time : 0
    readonly property var profile: status ? status.profile : undefined
    readonly property var setpoints: (status && status.setpoints) || ({})
    readonly property string loadedProfile: (status && status.loaded_profile) || ""
    readonly property string statusId: (status && status.id) || ""

    // The "sensors" event (MachineSensors): t_ext_1, t_bar_up, ..., m_pos, m_spd, motor_temp, weight_pred, ...
    property var sensorData: ({
        t_ext_1: 0, t_ext_2: 0, t_bar_up: 0, t_bar_mu: 0, t_bar_md: 0, t_bar_down: 0, t_tube: 0,
        t_motor_temp: 0, lam_temp: 0, p: 0, a_0: 0, a_1: 0, a_2: 0, a_3: 0, m_pos: 0, m_spd: 0, m_pwr: 0,
        m_cur: 0, bh_pwr: 0, bh_cur: 0, w_stat: false, motor_temp: 0, weight_pred: 0
    })

    property bool waterStatus: true
    property bool waitingForActionAlreadySent: false
    property real preheatTimeLeft: 0

    // The weight is NaN without a scale (BottomStatus: scaleConnected = !isNaN(sensors.w)).
    readonly property bool scaleConnected: sensors.w !== undefined && sensors.w !== null && !isNaN(sensors.w)

    function setStats(data) { if (data) status = data }
    function setSensors(data) { if (data) sensorData = data }
    function setWaterStatus(value) { waterStatus = !!value }
    function setWaitingForAction(value) { waitingForActionAlreadySent = !!value }
    function updatePreheatTimeLeft(value) { preheatTimeLeft = Number(value) || 0 }
}
