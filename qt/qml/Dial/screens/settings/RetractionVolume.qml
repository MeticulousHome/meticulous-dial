// The retraction distance (src/components/Settings/Advanced/RetractionVolume.tsx), a full-screen route opened
// from Brew Settings: a gauge of the volume the piston draws back after a shot, 80 to 150 ml in 1 ml steps.
// A push saves it (partial_retraction in mm), goes back to the previous screen and reopens Brew Settings.
// Until the settings arrive it shows the loading ring and hears nothing.
import QtQuick
import Dial
import "Retraction.js" as Retraction

Item {
    id: screen
    anchors.fill: parent
    property string type: "retraction_volume"
    property bool transitioning: false

    readonly property var settings: BackendSettings.data
    // useSyncedState: the first value is the stored one when the settings are already there, else 100 ml,
    // replaced once by the stored one when they arrive.
    property real localVolume: Retraction.RETRACTION_DEFAULT_VOLUME_ML
    property bool initializedFromSettings: false
    Component.onCompleted: {
        localVolume = settings ? Retraction.retractionMmToVolumeMl(settings.partial_retraction)
                               : Retraction.RETRACTION_DEFAULT_VOLUME_ML
        initializedFromSettings = !!settings
    }
    onSettingsChanged: {
        if (!initializedFromSettings && settings) {
            localVolume = Retraction.retractionMmToVolumeMl(settings.partial_retraction)
            initializedFromSettings = true
        }
    }

    readonly property real dialProbe_retractionVolume: localVolume

    DimScreen {}

    GestureHandler {
        // React ignores gestures only without settings; the bubble over the gauge (quick settings) would
        // then also change and save it, so it is excluded here too.
        enabled: !!screen.settings && !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.localVolume = Math.max(screen.localVolume - Retraction.RETRACTION_VOLUME_STEP_ML,
                                                  Retraction.RETRACTION_MIN_VOLUME_ML)
        onTurnRight: screen.localVolume = Math.min(screen.localVolume + Retraction.RETRACTION_VOLUME_STEP_ML,
                                                   Retraction.RETRACTION_MAX_VOLUME_ML)
        onPressDown: {
            BackendSettings.update({ partial_retraction: Retraction.volumeMlToRetractionMm(screen.localVolume) })
                .catch(() => {})
            Nav.setScreen(Nav.prev)
            Nav.setBubbleDisplay({ visible: true, component: "brewSettings" })
        }
    }

    LoadingScreen { visible: !screen.settings }

    SettingsGauge {
        visible: !!screen.settings
        value: screen.localVolume
        maxValue: Retraction.RETRACTION_MAX_VOLUME_ML
        minValue: Retraction.RETRACTION_MIN_VOLUME_ML
        precision: 0
        unit: "volume"
    }
}
