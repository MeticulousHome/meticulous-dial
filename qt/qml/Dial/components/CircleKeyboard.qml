// The circular keyboard (src/components/CircleKeyboard: CircleKeyboard.tsx, Keys.tsx, GlobeAlt.tsx,
// circle-keyboard.css). The characters sit every 7.25° (10° with onlyLetters) on a ring, their baselines
// 171.6 px from the center (the React svg: 390 px for a viewBox of 100, text at y = -44); the selected one
// is lifted out of the ring and shown big at the top (60 px letters, or the icon keys with their label).
// Turning the knob swaps the selected character with its neighbour and turns the ring by one step,
// 250 ms cubic-bezier(0.47, 1.63, 0.41, 0.8); past the last key ("cancel") the ring jumps the gap back to
// the first one. A push types the selected character (or space, ok, backspace, cancel, the character set
// switch); a click on the caps lock key toggles it, a double click locks it.
//
// API (CircleKeyboard.tsx props):
//   name                   the field's name over the text
//   defaultValue (string)  the text it starts with; every change of it replaces the text (React resets
//                          its caption when the defaultValue array changes); reset(value) does it on demand
//   onlyLetters            a-z and cancel only (read once, when created)
//   capitalizeFirstLetter  caps lock on while the text is empty (default true)
//   ignoreGestures         shouldIgnoreGesture; its default is React's: Nav.bubbleInterceptsGesture. Set it
//                          to replace that (e.g. `!Nav.bubbleInterceptsGesture` for a keyboard in the bubble)
//   prefix, suffix         fixed text shown before / after the input (not part of the value), 40 % and light
//   longPressEnabled       (added) set it with onLongPressed (React passes onLongPress): a long encoder press
//                          then first takes back the character its press typed (React does only then)
//   text                   the text typed (read; setting it replaces the text)
//   submitted(text)        "ok" with a non-blank text (trimmed); at 64 characters "ok" submits as it is
//   cancelled()            "cancel" (abort)
//   edited(text)           every change typed (onChange)
//   longPressed()          a long encoder press
// Test probes: dialFocusedLabel (the selected key), dialProbe_keyboardText, dialProbe_keyboardKey,
// dialProbe_keyboardType, dialProbe_capsLock ("inactive" | "active" | "locked").
import QtQuick
import Dial

Item {
    id: keyboard
    anchors.fill: parent

    // ---- API
    property string name: ""
    property string defaultValue: ""
    property bool onlyLetters: false
    property bool capitalizeFirstLetter: true
    property bool ignoreGestures: Nav.bubbleInterceptsGesture
    property string prefix: ""
    property string suffix: ""
    property bool longPressEnabled: false
    property string text: ""
    signal submitted(string text)
    signal cancelled()
    signal edited(string text)
    signal longPressed()

    function reset(value) {
        setCaption(String(value === undefined ? defaultValue : value).split(""))
    }

    readonly property string dialFocusedLabel: mainLetter
    readonly property string dialProbe_keyboardText: text
    readonly property string dialProbe_keyboardKey: mainLetter
    readonly property string dialProbe_keyboardType: keyboardType
    readonly property string dialProbe_capsLock: capsKeep ? "locked" : capsActive ? "active" : "inactive"

    // ---- Keys.tsx
    readonly property int firstPosition: 353
    readonly property string lastKey: "cancel"
    readonly property real rotateValue: 7.25
    readonly property real jumpRotateLetters: 90
    readonly property var alphabeth: "abcdefghijklmnopqrstuvwxyz".split("")
    readonly property var alphabethOnlyLetters: alphabeth.concat(["cancel"])
    readonly property real rotateValueLetters: (360 - jumpRotateLetters) / alphabethOnlyLetters.length
    readonly property var defaultAlphabet: alphabeth.concat("1234567890".split(""),
        ["space", "ok", "backspace", "capslock", "keyboardType", "cancel"])
    readonly property var smallAccentCharacters: "àáâãäåæçèéêëìíîïðñòóôõößøùúûüÿ".split("").concat(
        ["space", "ok", "backspace", "capslock", "keyboardType", "cancel"])
    readonly property var capitalAccentCharacters: "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖẞØÙÚÛÜÝ".split("").concat(
        ["space", "ok", "backspace", "capslock", "keyboardType", "cancel"])
    readonly property var specialCharacters: "-_!\"#$%&'()*+,./:;<=>?@[]^`{}|~".split("").concat(
        ["space", "ok", "backspace", "keyboardType", "cancel"])
    readonly property var caseAccentToUppercase: {
        const m = {}
        smallAccentCharacters.forEach((c, i) => { m[c] = capitalAccentCharacters[i] })
        return m
    }
    readonly property var caseAccentToLowercase: {
        const m = {}
        capitalAccentCharacters.forEach((c, i) => { m[c] = smallAccentCharacters[i] })
        return m
    }
    function getJumpRotate(type) {
        const characters = type === "DEFAULT" ? defaultAlphabet : type === "ONLY_LETTERS" ? alphabethOnlyLetters : capitalAccentCharacters
        return type === "ONLY_LETTERS" ? jumpRotateLetters
                                       : 360 - rotateValue * characters.filter(c => c.trim() !== "").length
    }
    function massageAlphabetWithMainChar(list, index) {
        const a = list.slice()
        a.splice(index, 0, " ")
        a.splice(index + 2, 0, " ")
        return a
    }

    // ---- state
    property string keyboardType: "DEFAULT"     // DEFAULT | ACCENT | SPECIAL | ONLY_LETTERS
    property var alphabet: []
    property string mainLetter: "a"
    property real wheelRotate: firstPosition
    property bool capsActive: false
    property bool capsKeep: false
    property var caption: []
    property bool lastPressInserted: false
    // The caption's font size as the React effect computes it from the element's computed style.
    property real captionFontSize: 40
    property real maxFontSize: 25

    readonly property int inputLimit: 64
    readonly property int maxCaptionCharactersBeforeShrink: 10
    readonly property int averageCaptionCharactersPerLine: 19
    readonly property int captionMinFontSize: 28
    readonly property int maxShownCharacters: 35
    readonly property real stepAngle: keyboardType === "ONLY_LETTERS" ? rotateValueLetters : rotateValue
    readonly property string firstKey: keyboardType === "DEFAULT" ? defaultAlphabet[0]
                                     : keyboardType === "ACCENT" ? smallAccentCharacters[0]
                                     : keyboardType === "ONLY_LETTERS" ? alphabethOnlyLetters[0]
                                     : specialCharacters[0]
    readonly property bool reverseScrolling: !!(BackendSettings.data && BackendSettings.data.reverse_scrolling
                                                && BackendSettings.data.reverse_scrolling.keyboard)

    Component.onCompleted: {
        keyboardType = onlyLetters ? "ONLY_LETTERS" : "DEFAULT"
        alphabet = massageAlphabetWithMainChar(onlyLetters ? alphabethOnlyLetters : defaultAlphabet, 0)
        caption = defaultValue.split("")
        text = defaultValue
        applyCase()
        captionLengthEffect()
    }
    onDefaultValueChanged: setCaption(defaultValue.split(""))
    onTextChanged: if (text !== caption.join("")) setCaption(text.split(""))

    function setCaption(list) {
        const lengthChanged = list.length !== caption.length
        caption = list
        text = list.join("")
        if (lengthChanged) captionLengthEffect()
    }

    // useEffect([capsLockActive]): every change of the caps lock re-cases the ring and the selected key.
    function setCaps(active, keep) {
        capsActive = active
        capsKeep = keep
        applyCase()
    }
    function applyCase() {
        alphabet = toUpperOrLowerCase(alphabet.slice())
        mainLetter = toUpperOrLowerCase(mainLetter)
    }
    function toUpperOrLowerCase(value) {
        if (Array.isArray(value)) {
            return value.map(c => {
                if (keyboardType === "SPECIAL") return c
                if (keyboardType === "ACCENT") {
                    const mapped = capsActive ? caseAccentToUppercase[c] : caseAccentToLowercase[c]
                    return mapped ? mapped : c
                }
                if (c.length > 1) return c
                return capsActive ? c.toUpperCase() : c.toLowerCase()
            })
        }
        return value.length > 1 ? value : capsActive ? value.toUpperCase() : value.toLowerCase()
    }

    // useEffect([caption.length]): caps lock on an empty text, and the caption's font shrinking from 40 px
    // (as computed now: once shrunk it does not grow back, as in React) to 28 px past 10 characters.
    function captionLengthEffect() {
        if (caption.length === 0) setCaps(capitalizeFirstLetter, capsKeep)
        let baseFontSize = Math.floor(captionFontSize)
        const maxBefore = maxFontSize
        if (baseFontSize > maxFontSize) maxFontSize = baseFontSize
        let adjusted = baseFontSize
        if (caption.length > maxCaptionCharactersBeforeShrink) {
            baseFontSize = Math.max(baseFontSize, maxBefore)
            const fontScaleFactor = -((baseFontSize - captionMinFontSize)
                                      / (maxCaptionCharactersBeforeShrink - averageCaptionCharactersPerLine))
            const excessLength = caption.length - maxCaptionCharactersBeforeShrink
            adjusted = Math.max(baseFontSize - excessLength * fontScaleFactor, captionMinFontSize)
        }
        captionFontSize = adjusted
    }

    // moveElements(right): "right" selects the next key (the knob turned left, unless reversed).
    function moveElements(right) {
        const current = alphabet
        const newAlphabet = current.slice()
        const letter = mainLetter
        const rotate = wheelRotate
        const onlyLettersType = keyboardType === "ONLY_LETTERS"
        const i = current.findIndex(element => element.toLowerCase() === letter.toLowerCase())
        const pm2 = i + (!right ? -2 : 2)
        const pmr = onlyLettersType ? rotate + (right ? -rotateValueLetters : rotateValueLetters)
                                    : rotate + (right ? -rotateValue : rotateValue)
        const newLetter = current[pm2]
        const p1 = i + 1
        const m1 = i - 1

        if (!current[pm2]) {
            newAlphabet.splice(0, 1)
            newAlphabet.splice(-1)
            newAlphabet.splice(!right ? 1 : -2, 1)
            if (!right) {
                newAlphabet.push(" ")
                newAlphabet.push(lastKey)
                newAlphabet.push(" ")
            } else {
                newAlphabet.unshift(" ")
                newAlphabet.unshift(firstKey)
                newAlphabet.unshift(" ")
            }
            const jumpRotate = getJumpRotate(keyboardType)
            const newRotate = onlyLettersType
                ? (!right ? rotate + rotateValueLetters + jumpRotateLetters : rotate - (rotateValueLetters + jumpRotateLetters))
                : (!right ? rotate + rotateValue + jumpRotate : rotate - rotateValue - jumpRotate)
            alphabet = toUpperOrLowerCase(newAlphabet)
            mainLetter = toUpperOrLowerCase(!right ? lastKey : firstKey)
            wheelRotate = newRotate
            return
        }

        newAlphabet[i] = " "
        newAlphabet[pm2] = " "
        newAlphabet[!right ? p1 : m1] = letter
        newAlphabet[!right ? m1 : p1] = newLetter
        alphabet = toUpperOrLowerCase(newAlphabet)
        mainLetter = toUpperOrLowerCase(newLetter)
        wheelRotate = pmr
    }

    function pressDown() {
        lastPressInserted = false
        const letter = mainLetter
        if (caption.length >= inputLimit && letter !== "backspace") {
            if (letter === "ok") submitted(caption.join("").trim())
            if (letter === "cancel") {
                setCaption(defaultValue.split(""))
                cancelled()
            }
            return
        }
        // The shake class is removed on every press; a press that shakes again keeps it running.
        const shakes = (letter === "space" && (caption.length >= inputLimit - 1 || caption.join("").trim().length === 0))
                    || (letter === "ok" && (caption.length === 0 || caption.join("").trim().length === 0))
        if (!shakes) stopShake()
        switch (letter) {
        case "space": {
            if (caption.length >= inputLimit - 1) { shake(); return }
            if (caption.length < inputLimit && caption.join("").trim().length === 0) { shake(); return }
            const value = caption.concat(" ")
            setCaption(value)
            lastPressInserted = true
            edited(value.join(""))
            return
        }
        case "ok":
            if (caption.length === 0 || caption.join("").trim().length === 0) { shake(); return }
            submitted(caption.join("").trim())
            return
        case "backspace":
            if (caption.length > 0) {
                const value = caption.slice(0, -1)
                setCaption(value)
                edited(value.join(""))
            }
            return
        case "cancel":
            cancelled()
            return
        case "capslock":
            return
        case "keyboardType":
            if (keyboardType === "DEFAULT") {
                keyboardType = "ACCENT"
                alphabet = capsActive ? massageAlphabetWithMainChar(capitalAccentCharacters, capitalAccentCharacters.length - 2)
                                      : massageAlphabetWithMainChar(smallAccentCharacters, smallAccentCharacters.length - 2)
                wheelRotate = 467
            } else if (keyboardType === "ACCENT") {
                keyboardType = "SPECIAL"
                alphabet = massageAlphabetWithMainChar(specialCharacters, specialCharacters.length - 2)
                wheelRotate = 466
            } else {
                keyboardType = "DEFAULT"
                alphabet = massageAlphabetWithMainChar(defaultAlphabet, defaultAlphabet.length - 2)
                wheelRotate = 423
            }
            return
        default: {
            const value = caption.concat(letter)
            setCaption(value)
            lastPressInserted = true
            edited(value.join(""))
            if (!/^[A-Za-z]$/.test(letter) && capsActive) return
            if (!capsKeep && capsActive) setCaps(false, capsKeep)
        }
        }
    }

    GestureHandler {
        enabled: !keyboard.ignoreGestures && keyboard.visible
        onTurnLeft: keyboard.moveElements(!keyboard.reverseScrolling)
        onTurnRight: keyboard.moveElements(keyboard.reverseScrolling)
        onDoubleClick: {
            if (keyboard.mainLetter === "capslock")
                keyboard.capsKeep ? keyboard.setCaps(false, false) : keyboard.setCaps(true, true)
        }
        onClick: {
            if (keyboard.mainLetter === "capslock")
                keyboard.capsActive ? keyboard.setCaps(false, false) : keyboard.setCaps(true, false)
        }
        // A screen without a long press (React passes no onLongPress) just does not handle longPressed; the
        // take-back of the character, which a screen without one must not do, needs longPressEnabled.
        onLongEncoder: {
            if (keyboard.longPressEnabled && keyboard.lastPressInserted) {
                const value = keyboard.caption.slice(0, -1)
                keyboard.setCaption(value)
                keyboard.edited(value.join(""))
            }
            keyboard.lastPressInserted = false
            keyboard.longPressed()
        }
        onPressDown: keyboard.pressDown()
    }

    // ---- the caption shake (globals.css shakeAnimation: 0.3 s linear, ±10 px; the class stays 400 ms)
    property real shakeX: 0
    property bool shakeClass: false
    function shake() {
        if (shakeClass) return
        shakeClass = true
        shakeAnimation.restart()
        shakeClassTimer.restart()
    }
    function stopShake() {
        shakeClass = false
        shakeClassTimer.stop()
        shakeAnimation.stop()
        shakeX = 0
    }
    Timer {
        id: shakeClassTimer
        interval: 400
        onTriggered: keyboard.shakeClass = false
    }
    SequentialAnimation {
        id: shakeAnimation
        NumberAnimation { target: keyboard; property: "shakeX"; from: 0; to: -10; duration: 60 }
        NumberAnimation { target: keyboard; property: "shakeX"; to: 10; duration: 60 }
        NumberAnimation { target: keyboard; property: "shakeX"; to: -10; duration: 60 }
        NumberAnimation { target: keyboard; property: "shakeX"; to: 10; duration: 60 }
        NumberAnimation { target: keyboard; property: "shakeX"; to: 0; duration: 60 }
    }

    // ---- geometry of the fontello keys (fontello: 1000 units per em, ascent 850; with its OS/2
    // USE_TYPO_METRICS line gap of 90 a CSS line box is 1.09 em and its baseline 0.895 em down). The SVGs of
    // gen_icons are the em box (advance x 1000) padded by 120 units.
    readonly property var iconAdvance: ({ space: 1086, ok: 1000, backspace: 1000, capslock: 791, cancel: 900 })
    readonly property int iconPad: 120
    readonly property real ringRadius: 171.6
    readonly property real ringIconSize: 18.72
    readonly property string labelFont: "Abc"   // 'Abc' matches no font: the system's fallback, as in WebKit

    // CSS line boxes. Chromium lays ABC Diatype out with its hhea metrics (ascent 0.85, descent 0.15 em,
    // each rounded to whole pixels) where Qt uses the win metrics (0.975 em ascent); a Text's topPadding
    // moves Qt's first baseline onto Chromium's, and lineHeight FixedHeight spaces the lines like CSS.
    FontMetrics { id: diatypeMetrics; font.family: Theme.fontRegular; font.pixelSize: 1000 }
    FontMetrics { id: labelMetrics; font.family: keyboard.labelFont; font.bold: true; font.pixelSize: 1000 }
    function cssAscent(px) { return Math.round(0.85 * px) }
    function cssLine(px) { return Math.round(0.85 * px) + Math.round(0.15 * px) }
    function diatypeTopPadding(px) { return cssAscent(px) - diatypeMetrics.ascent / 1000 * px }

    function ringIconSource(key) {
        if (key === "capslock")
            return Theme.asset(capsKeep || capsActive ? "icons/profile-kb-ring-capslock.svg" : "icons/profile-kb-ring-capslock-outline.svg")
        return Theme.asset("icons/profile-kb-ring-" + key + ".svg")
    }

    // ---- the selected key
    readonly property bool mainIsIcon: mainLetter in iconAdvance
    // .main-letter-space + .icon-*-selected: font size and top of the box; the label's anchor.
    readonly property var mainIcon: ({
        space: { size: 52, top: 28 },
        ok: { size: 58, top: 24, label: "Ok", bottom: 16, center: 0.5 },
        backspace: { size: 62, top: 24, label: "Back", bottom: 11, center: 0.54 },
        capslock: { size: 54, top: 24, bottom: 20, center: 0.5 },
        cancel: { size: 50, top: 30, label: "Abort", bottom: 17, center: 0.35 }
    })

    Text {
        visible: !keyboard.mainIsIcon && keyboard.mainLetter !== "keyboardType"
        anchors.horizontalCenter: parent.horizontalCenter
        y: 15
        topPadding: keyboard.diatypeTopPadding(60)
        text: keyboard.mainLetter
        textFormat: Text.PlainText
        color: "white"
        font.family: Theme.fontRegular
        font.pixelSize: 60
    }

    Item {
        id: mainIconBox
        visible: keyboard.mainIsIcon
        readonly property var spec: keyboard.mainIcon[keyboard.mainLetter] || keyboard.mainIcon.space
        readonly property real size: spec.size
        readonly property real advance: (keyboard.iconAdvance[keyboard.mainLetter] || 1000) * size / 1000
        // The div: as wide as the glyph, centered; its line box 1.09 em tall from `top`.
        x: (keyboard.width - advance) / 2
        y: spec.top
        width: advance
        height: 1.09 * size

        Image {
            readonly property real unit: mainIconBox.size / 1000
            x: -keyboard.iconPad * unit
            y: 0.045 * mainIconBox.size - keyboard.iconPad * unit
            width: Math.ceil((keyboard.iconAdvance[keyboard.mainLetter] + 2 * keyboard.iconPad) * unit)
            height: Math.ceil((1000 + 2 * keyboard.iconPad) * unit)
            sourceSize: Qt.size(width, height)
            opacity: keyboard.mainLetter === "capslock" && !keyboard.capsKeep ? 0.4 : 1
            source: !keyboard.mainIsIcon ? ""
                  : keyboard.mainLetter !== "capslock" ? Theme.asset("icons/profile-kb-main-" + keyboard.mainLetter + ".svg")
                  : Theme.asset("icons/profile-kb-main-capslock-" + (keyboard.capsKeep ? "locked" : keyboard.capsActive ? "active" : "inactive") + ".svg")
        }
        // .main-letter__label: bold 17 px, centred on `center` of the box's width, its line box `bottom` px
        // under the box (the baseline a rounded descent above the line box's bottom).
        Text {
            visible: !!(mainIconBox.spec.label || keyboard.mainLetter === "capslock")
            x: mainIconBox.width * (mainIconBox.spec.center || 0.5) - width / 2
            y: mainIconBox.height + (mainIconBox.spec.bottom || 17) - Math.round(labelMetrics.descent / 1000 * 17) - baselineOffset
            text: keyboard.mainLetter === "capslock" ? (keyboard.capsActive ? "capslock" : "CAPSLOCK") : (mainIconBox.spec.label || "")
            color: "white"
            font.family: keyboard.labelFont
            font.bold: true
            font.pixelSize: 17
        }
    }

    // keyboardType: the 55 px globe (white: currentColor) at top 24, "Special Characters" 62 px under the
    // box's top in two lines (the label is as narrow as its longest word), centred at 54 % of the globe.
    Item {
        visible: keyboard.mainLetter === "keyboardType"
        x: (keyboard.width - 55) / 2
        y: 24
        width: 55
        height: 55
        Image {
            anchors.fill: parent
            sourceSize: Qt.size(55, 55)
            source: Theme.asset("icons/profile-globe-alt.svg")
        }
        Text {
            x: 55 * 0.54 - width / 2
            y: 62 + Math.round(labelMetrics.ascent / 1000 * 17) - labelMetrics.ascent / 1000 * 17
            lineHeightMode: Text.FixedHeight
            lineHeight: Math.round(labelMetrics.ascent / 1000 * 17) + Math.round(labelMetrics.descent / 1000 * 17)
            text: "Special\nCharacters"
            horizontalAlignment: Text.AlignHCenter
            color: "white"
            font.family: keyboard.labelFont
            font.bold: true
            font.pixelSize: 17
        }
    }

    // ---- the caption: the name (25 px light, 40 %), then the text (bold, 40 px shrinking) at 40 % from the
    // top; spaces are invisible "_", a "_" cursor fades out and in (blinker, 1 s linear), the last 35
    // characters after "...".
    function escapeHtml(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    }
    readonly property bool showCursor: caption.length > 0 && caption.length < inputLimit
    // One markup for the text and one for the cursor layer: the same characters (so the same layout), with
    // everything but the cursor transparent in the second.
    function captionMarkup(cursorLayer) {
        const hidden = "<span style=\"color:transparent\">"
        const affix = cursorLayer ? hidden : "<span style=\"font-weight:300; color:rgba(255,255,255,0.4)\">"
        const plain = cursorLayer ? hidden : "<span>"
        let html = ""
        if (caption.length > maxShownCharacters) html += plain + "... </span><br>"
        if (prefix) html += affix + escapeHtml(prefix) + "</span>"
        const shown = caption.slice(Math.max(caption.length - maxShownCharacters, 0))
        let run = ""
        for (const c of shown) run += c === " " ? hidden + "_</span>" : (cursorLayer ? hidden + escapeHtml(c) + "</span>" : escapeHtml(c))
        html += run
        if (showCursor) html += (cursorLayer ? "<span style=\"color:white\">" : hidden) + "_</span>"
        if (suffix) html += affix + escapeHtml(suffix) + "</span>"
        return html
    }

    // .caption-content at top 40 %: the title block (300 px, its lines 25 px apart, margin-bottom 10 px),
    // then the caption (an inline-block 280 px wide, centred).
    readonly property real captionTop: Math.round(keyboard.height * 0.4)
    readonly property real titleHeight: (titleText.text.length > 0 ? titleText.lineCount * cssLine(25) : 0) + 10
    readonly property int captionPixelSize: Math.round(captionFontSize)

    Text {
        id: titleText
        x: (keyboard.width - width) / 2
        y: keyboard.captionTop
        width: 300
        topPadding: keyboard.diatypeTopPadding(25)
        lineHeightMode: Text.FixedHeight
        lineHeight: keyboard.cssLine(25)
        text: keyboard.name
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        horizontalAlignment: Text.AlignHCenter
        color: "white"
        opacity: 0.4
        font.family: Theme.fontRegular
        font.weight: Font.Light
        font.pixelSize: 25
    }
    Item {
        x: (keyboard.width - width) / 2 + keyboard.shakeX
        y: keyboard.captionTop + keyboard.titleHeight
        width: 280
        Text {
            id: captionText
            width: 280
            // Rich text with a fixed line height puts the baseline at 4/5 of the line (QTextDocumentLayout).
            topPadding: keyboard.cssAscent(keyboard.captionPixelSize) - 0.8 * keyboard.cssLine(keyboard.captionPixelSize)
            lineHeightMode: Text.FixedHeight
            lineHeight: keyboard.cssLine(keyboard.captionPixelSize)
            text: keyboard.captionMarkup(false)
            textFormat: Text.RichText
            wrapMode: Text.Wrap
            horizontalAlignment: Text.AlignHCenter
            color: "white"
            font.family: Theme.fontRegular
            font.bold: true
            font.pixelSize: keyboard.captionPixelSize
        }
        Text {
            width: 280
            visible: keyboard.showCursor
            opacity: blink.t < 0.5 ? 1 - 2 * blink.t : 2 * blink.t - 1
            topPadding: captionText.topPadding
            lineHeightMode: Text.FixedHeight
            lineHeight: captionText.lineHeight
            text: keyboard.captionMarkup(true)
            textFormat: Text.RichText
            wrapMode: Text.Wrap
            horizontalAlignment: Text.AlignHCenter
            color: "white"
            font.family: Theme.fontRegular
            font.bold: true
            font.pixelSize: keyboard.captionPixelSize
            QtObject { id: blink; property real t: 0 }
            NumberAnimation {
                target: blink
                property: "t"
                from: 0; to: 1
                duration: 1000
                loops: Animation.Infinite
                running: keyboard.visible && keyboard.showCursor
            }
        }
    }

    // ---- the ring
    Item {
        id: wheel
        x: keyboard.width / 2
        y: keyboard.height / 2
        rotation: keyboard.wheelRotate
        Behavior on rotation {
            NumberAnimation { duration: 250; easing.type: Easing.Bezier; easing.bezierCurve: [0.47, 1.63, 0.41, 0.8, 1, 1] }
        }
        // The count, not the array, is the model: a step only swaps characters, and a new array as the
        // model would rebuild every key (about 100 ms on the Nano).
        Repeater {
            model: keyboard.alphabet.length
            delegate: Item {
                id: slot
                required property int index
                readonly property string key: keyboard.alphabet[index] || ""
                readonly property bool isIcon: key in keyboard.iconAdvance
                visible: key.trim() !== "" && key.toLowerCase() !== keyboard.mainLetter.toLowerCase()
                rotation: index * keyboard.stepAngle

                Text {
                    visible: !slot.isIcon && slot.key !== "keyboardType"
                    x: -implicitWidth / 2
                    y: -keyboard.ringRadius - baselineOffset
                    text: slot.key
                    textFormat: Text.PlainText
                    color: Qt.rgba(1, 1, 1, 0.4)
                    font.family: Theme.fontRegular
                    font.pixelSize: 25
                }
                Image {
                    readonly property real unit: keyboard.ringIconSize / 1000
                    readonly property real advance: keyboard.iconAdvance[slot.key] || 1000
                    visible: slot.isIcon
                    x: -(advance / 2 + keyboard.iconPad) * unit
                    y: -keyboard.ringRadius - (850 + keyboard.iconPad) * unit
                    width: Math.ceil((advance + 2 * keyboard.iconPad) * unit)
                    height: Math.ceil((1000 + 2 * keyboard.iconPad) * unit)
                    sourceSize: Qt.size(width, height)
                    opacity: slot.key === "capslock" && keyboard.capsKeep ? 1 : 0.4
                    source: slot.isIcon ? keyboard.ringIconSource(slot.key) : ""
                }
                // GlobeAlt width 6 height 6 at (-3.5, -48.5) user units.
                Image {
                    visible: slot.key === "keyboardType"
                    x: -3.5 * 3.9
                    y: -48.5 * 3.9
                    width: 6 * 3.9
                    height: 6 * 3.9
                    sourceSize: Qt.size(24, 24)
                    opacity: 0.4
                    source: slot.key === "keyboardType" ? Theme.asset("icons/profile-globe-alt.svg") : ""
                }
            }
        }
    }
}
