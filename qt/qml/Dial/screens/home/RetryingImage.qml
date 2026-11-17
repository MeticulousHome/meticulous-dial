// A card picture that loads again after it fails. An Image never retries by itself, and the home can open
// before the Wi-Fi connects (the Dial is up 6-7 s after boot): a profile picture hosted on the internet then
// fails ("Host ... not found") and its card stays without it until the home is rebuilt. A remote picture
// that fails loads again 2, 4, 8, 16, 32 and 64 s later (about two minutes); a picture that loaded is never
// reloaded. The backend's own pictures are not retried: when one of them fails it is missing (404).
import QtQuick
import Dial

Image {
    id: image
    // The picture to show; set it instead of source, which goes blank for the moment of a retry.
    property url picture
    property int retries: 0
    property bool reloading: false
    readonly property bool remote: /^https?:/.test(String(picture)) && !String(picture).startsWith(Api.base + "/")
    readonly property bool canRetry: remote && retries < 6

    source: reloading ? "" : picture
    onPictureChanged: { retries = 0; retry.stop() }
    onStatusChanged: {
        if (status === Image.Error && canRetry) retry.restart()
        stalled.running = status === Image.Loading && canRetry
    }
    onProgressChanged: if (stalled.running) stalled.restart()

    function reload() {
        retries++
        // Clearing the source drops the failed load; setting it again starts a new one.
        reloading = true
        reloading = false
    }

    Timer {
        id: retry
        interval: 2000 * Math.pow(2, image.retries)
        onTriggered: image.reload()
    }
    // A load with no progress for 15 s counts as failed: when a host's name does not resolve, Qt 6.4 can
    // leave one of several requests to that HTTPS host waiting forever, with no error to retry on.
    Timer {
        id: stalled
        interval: 15000
        onTriggered: image.reload()
    }
}
