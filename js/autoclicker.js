/* CaseClicker - Browser Autoclicker
 * Current cursor or fixed position, like a desktop autoclicker.
 * Browser limitation: clicks can only be synthesized inside this webpage.
 */
(function () {
    "use strict";

    var STORAGE_KEY = "caseClicker.autoclicker.v2";
    var defaults = {
        enabled: false,
        interval: 250,
        button: "left",
        clickType: "single",
        locationMode: "current",
        pickedX: 0,
        pickedY: 0,
        repeatMode: "infinite",
        repeatCount: 100,
        hotkey: "F6",
        visibilityHotkey: "F7",
        autoStart: false
    };

    var state = loadState();
    var timer = null;
    var clickCount = 0;
    var hotkeyCapture = false;
    var visibilityHotkeyCapture = false;
    var pickingPosition = false;
    var panelVisible = false;
    var mouseX = 0;
    var mouseY = 0;

    function loadState() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            saved.enabled = false;
            return Object.assign({}, defaults, saved);
        } catch (error) {
            return Object.assign({}, defaults);
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function number(id, fallback) {
        var input = document.getElementById(id);
        var value = input ? Number(input.value) : fallback;
        return Number.isFinite(value) ? value : fallback;
    }

    function updatePointer(event) {
        mouseX = event.clientX;
        mouseY = event.clientY;

        var pointer = document.getElementById("acPointer");
        if (pointer) {
            pointer.textContent = Math.round(mouseX) + ", " + Math.round(mouseY);
        }

        if (state.locationMode === "current") {
            var target = document.getElementById("acTarget");
            if (target) {
                target.textContent = "Current cursor (" +
                    Math.round(mouseX) + ", " + Math.round(mouseY) + ")";
            }
        }
    }

    function getPoint() {
        if (state.locationMode === "picked") {
            return {
                x: clamp(Number(state.pickedX) || 0, 0, window.innerWidth - 1),
                y: clamp(Number(state.pickedY) || 0, 0, window.innerHeight - 1)
            };
        }

        return { x: mouseX, y: mouseY };
    }

    function getTarget(point) {
        var panel = document.getElementById("caseClickerAutoclicker");
        var element;

        if (panel && panel.contains(document.elementFromPoint(point.x, point.y))) {
            panel.style.pointerEvents = "none";
            element = document.elementFromPoint(point.x, point.y);
            panel.style.pointerEvents = "";
        } else {
            element = document.elementFromPoint(point.x, point.y);
        }

        return element;
    }

    function mouseEvent(type, point, button, detail) {
        return new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: point.x,
            clientY: point.y,
            screenX: point.x,
            screenY: point.y,
            button: button,
            buttons: button === 0 ? 1 : button === 1 ? 4 : 2,
            detail: detail || 1
        });
    }

    function clickElement(element, point) {
        if (!element) {
            return false;
        }

        var button = state.button === "right" ? 2 :
            state.button === "middle" ? 1 : 0;

        element.dispatchEvent(mouseEvent("mousedown", point, button));
        element.dispatchEvent(mouseEvent("mouseup", point, button));

        if (button === 2) {
            element.dispatchEvent(mouseEvent("contextmenu", point, button));
        } else {
            element.dispatchEvent(mouseEvent("click", point, button, 1));

            if (state.clickType === "double") {
                element.dispatchEvent(mouseEvent("mousedown", point, button, 2));
                element.dispatchEvent(mouseEvent("mouseup", point, button, 2));
                element.dispatchEvent(mouseEvent("click", point, button, 2));
                element.dispatchEvent(mouseEvent("dblclick", point, button, 2));
            }
        }

        return true;
    }

    function performClick() {
        var point = getPoint();

        if (
            point.x < 0 || point.y < 0 ||
            point.x >= window.innerWidth ||
            point.y >= window.innerHeight
        ) {
            return false;
        }

        var element = getTarget(point);

        if (!element) {
            return false;
        }

        if (clickElement(element, point)) {
            clickCount += state.clickType === "double" ? 2 : 1;

            var count = document.getElementById("acClickCount");
            if (count) {
                count.textContent = clickCount.toLocaleString();
            }

            var last = document.getElementById("acLastTarget");
            if (last) {
                last.textContent =
                    (element.id ? "#" + element.id : element.tagName.toLowerCase()) +
                    " @ " + Math.round(point.x) + ", " + Math.round(point.y);
            }

            return true;
        }

        return false;
    }

    function scheduleNext() {
        if (!state.enabled) {
            timer = null;
            return;
        }

        if (state.repeatMode === "count" && clickCount >= state.repeatCount) {
            stop();
            return;
        }

        timer = window.setTimeout(function () {
            performClick();
            scheduleNext();
        }, clamp(Math.round(Number(state.interval) || 250), 1, 10000));
    }

    function start() {
        if (state.enabled) {
            return;
        }

        state.enabled = true;
        clickCount = 0;
        saveState();
        updateUI();
        performClick();
        scheduleNext();
    }

    function stop() {
        state.enabled = false;

        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }

        saveState();
        updateUI();
    }

    function toggle() {
        if (state.enabled) {
            stop();
        } else {
            start();
        }
    }

    function updateSettings() {
        state.interval = clamp(Math.round(number("acInterval", 250)), 1, 10000);
        state.button = document.getElementById("acButton").value;
        state.clickType = document.getElementById("acClickType").value;
        state.locationMode = document.getElementById("acLocationMode").value;

        if (state.locationMode === "picked") {
            beginPositionPick();
        } else {
            pickingPosition = false;
            var pickPanel = document.getElementById("caseClickerAutoclicker");
            if (pickPanel) {
                pickPanel.style.pointerEvents = "";
            }
        }
        state.repeatMode = document.getElementById("acRepeatMode").value;
        state.repeatCount = clamp(Math.round(number("acRepeatCount", 100)), 1, 1000000);
        state.autoStart = document.getElementById("acAutoStart").checked;

        if (state.locationMode === "picked") {
            state.pickedX = clamp(Math.round(number("acPickedX", 0)), 0, window.innerWidth - 1);
            state.pickedY = clamp(Math.round(number("acPickedY", 0)), 0, window.innerHeight - 1);
        }

        saveState();
        updateUI();
    }

    function updateUI() {
        var panel = document.getElementById("caseClickerAutoclicker");
        if (!panel) {
            return;
        }

        document.getElementById("acStatus").textContent = state.enabled ? "RUNNING" : "STOPPED";

        var toggle = document.getElementById("acToggle");
        toggle.textContent = state.enabled ? "STOP" : "START";
        toggle.classList.toggle("running", state.enabled);
        panel.classList.toggle("active", state.enabled);

        document.getElementById("acInterval").value = state.interval;
        document.getElementById("acButton").value = state.button;
        document.getElementById("acClickType").value = state.clickType;
        document.getElementById("acLocationMode").value = state.locationMode;
        document.getElementById("acRepeatMode").value = state.repeatMode;
        document.getElementById("acRepeatCount").value = state.repeatCount;
        document.getElementById("acPickedX").value = state.pickedX;
        document.getElementById("acPickedY").value = state.pickedY;
        document.getElementById("acAutoStart").checked = state.autoStart;
        document.getElementById("acPickStatus").textContent = pickingPosition ? "CLICK ANYWHERE TO SET POSITION" : "Waiting for a screen click";
        document.getElementById("acPickStatus").classList.toggle("picking", pickingPosition);

        document.getElementById("acPickedSettings").style.display =
            state.locationMode === "picked" ? "grid" : "none";
        document.getElementById("acRepeatCountRow").style.display =
            state.repeatMode === "count" ? "block" : "none";

        document.getElementById("acTarget").textContent =
            state.locationMode === "picked"
                ? "Fixed position (" + state.pickedX + ", " + state.pickedY + ")"
                : "Current cursor (" + Math.round(mouseX) + ", " + Math.round(mouseY) + ")";

        if (!hotkeyCapture) {
            document.getElementById("acHotkey").textContent = state.hotkey;
        }
    }

    function setPickedPosition(x, y) {
        state.pickedX = clamp(Math.round(x), 0, window.innerWidth - 1);
        state.pickedY = clamp(Math.round(y), 0, window.innerHeight - 1);
        state.locationMode = "picked";
        pickingPosition = false;
        saveState();
        updateUI();
    }

    function beginPositionPick() {
        pickingPosition = true;
        var hint = document.getElementById("acPickStatus");
        if (hint) {
            hint.textContent = "CLICK ANYWHERE TO SET POSITION";
            hint.classList.add("picking");
        }
        var panel = document.getElementById("caseClickerAutoclicker");
        if (panel) {
            panel.style.pointerEvents = "none";
        }
    }

    function handlePositionPick(event) {
        if (!pickingPosition) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        var panel = document.getElementById("caseClickerAutoclicker");
        if (panel) {
            panel.style.pointerEvents = "";
        }

        setPickedPosition(event.clientX, event.clientY);
    }

    function buildUI() {
        if (document.getElementById("caseClickerAutoclicker")) {
            return;
        }

        var panel = document.createElement("section");
        panel.id = "caseClickerAutoclicker";
        panel.className = "case-clicker-autoclicker noselect";

        panel.innerHTML =
            '<div class="acHeader">' +
                '<div><div class="acTitle">AUTOCLICKER</div>' +
                '<div class="acSubtitle">Current cursor / fixed position</div></div>' +
                '<button type="button" id="acMinimize" class="acIconButton">−</button>' +
            '</div>' +
            '<div class="acBody">' +
                '<div class="acStatusRow"><span>Status</span><strong id="acStatus">STOPPED</strong></div>' +
                '<button type="button" id="acToggle" class="acMainButton">START</button>' +
                '<div class="acTargetBox">Target: <strong id="acTarget">Current cursor (0, 0)</strong>' +
                '<br><small>Pointer: <span id="acPointer">0, 0</span></small></div>' +
                '<div class="acGrid">' +
                    '<label>Click interval (ms)<input id="acInterval" type="number" min="1" max="10000" step="1"></label>' +
                    '<label>Mouse button<select id="acButton"><option value="left">Left</option><option value="right">Right</option><option value="middle">Middle</option></select></label>' +
                    '<label>Click type<select id="acClickType"><option value="single">Single</option><option value="double">Double</option></select></label>' +
                    '<label>Click position<select id="acLocationMode"><option value="current">Current cursor</option><option value="picked">Fixed position</option></select></label>' +
                '</div>' +
                '<div id="acPickedSettings" class="acGrid">' +
                    '<label>X<input id="acPickedX" type="number" min="0" step="1"></label>' +
                    '<label>Y<input id="acPickedY" type="number" min="0" step="1"></label>' +
                    '<button type="button" id="acPickHere" class="acSmallButton">PICK POSITION</button><small id="acPickStatus" class="acPickStatus">Waiting for a screen click</small>' +
                '</div>' +
                '<div class="acGrid">' +
                    '<label>Repeat<select id="acRepeatMode"><option value="infinite">Until stopped</option><option value="count">Number of clicks</option></select></label>' +
                    '<label id="acRepeatCountRow">Click count<input id="acRepeatCount" type="number" min="1" max="1000000" step="1"></label>' +
                '</div>' +
                '<div class="acHotkeyRow"><span>Toggle hotkey</span><button type="button" id="acHotkey" class="acHotkeyButton">F6</button></div>' +
                '<div class="acBottomRow"><span>Clicks: <strong id="acClickCount">0</strong></span>' +
                '<button type="button" id="acClickNow" class="acSmallButton">CLICK NOW</button></div>' +
                '<div class="acBottomRow"><span>Last target: <strong id="acLastTarget">None</strong></span></div>' +
                '<label class="acCheckbox"><input id="acAutoStart" type="checkbox"> Auto-start on load</label>' +
                '<div class="acHint">Current cursor mode follows your mouse every click. Fixed position repeatedly clicks the saved X/Y location.</div>' +
            '</div>';

        document.body.appendChild(panel);
        panel.classList.remove("visible");
        document.addEventListener("mousemove", updatePointer);

        [
            "acInterval", "acButton", "acClickType", "acLocationMode",
            "acRepeatMode", "acRepeatCount", "acPickedX", "acPickedY", "acAutoStart"
        ].forEach(function (id) {
            document.getElementById(id).addEventListener("input", updateSettings);
            document.getElementById(id).addEventListener("change", updateSettings);
        });

        document.getElementById("acToggle").addEventListener("click", toggle);
        document.getElementById("acClickNow").addEventListener("click", performClick);
        document.getElementById("acPickHere").addEventListener("click", beginPositionPick);
        document.addEventListener("click", handlePositionPick, true);

        document.getElementById("acMinimize").addEventListener("click", function () {
            panel.classList.toggle("collapsed");
            this.textContent = panel.classList.contains("collapsed") ? "+" : "−";
        });

        document.getElementById("acHotkey").addEventListener("click", function () {
            hotkeyCapture = true;
            this.textContent = "PRESS KEY...";
        });

        document.addEventListener("keydown", function (event) {
            if (hotkeyCapture) {
                event.preventDefault();
                if (event.key !== "Escape") {
                    state.hotkey = event.key.length === 1 ? event.key.toUpperCase() : event.key;
                    saveState();
                }
                hotkeyCapture = false;
                updateUI();
                return;
            }

            if (event.key === state.visibilityHotkey) {
                event.preventDefault();
                panelVisible = !panelVisible;
                var panel = document.getElementById("caseClickerAutoclicker");
                if (panel) {
                    panel.classList.toggle("visible", panelVisible);
                }
                return;
            }

            if (event.key === state.hotkey) {
                var tag = event.target && event.target.tagName ?
                    event.target.tagName.toLowerCase() : "";

                if (tag !== "input" && tag !== "textarea" && tag !== "select") {
                    event.preventDefault();
                    toggle();
                }
            }
        });

        updateUI();

        if (state.autoStart) {
            window.setTimeout(start, 500);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildUI);
    } else {
        buildUI();
    }
})();