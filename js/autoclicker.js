/* CaseClicker - Built-in Autoclicker
 * Uses the game's existing #case click target so autoclicks follow the same
 * code path as normal player clicks.
 */
(function () {
    "use strict";

    var STORAGE_KEY = "caseClicker.autoclicker.v1";

    var defaults = {
        enabled: false,
        interval: 250,
        burst: 1,
        variance: 0,
        autoStart: false,
        hotkey: "F6"
    };

    var state = loadState();
    var timer = null;
    var clickCount = 0;
    var hotkeyCapture = false;

    function loadState() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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

    function getNumber(id, fallback) {
        var value = Number(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
    }

    function isGameReady() {
        var caseElement = document.getElementById("case");

        if (!caseElement) {
            return false;
        }

        var modal = document.querySelector(".modalWindow");

        if (modal) {
            var modalStyle = window.getComputedStyle(modal);
            if (modalStyle.display !== "none" && modalStyle.visibility !== "hidden") {
                return false;
            }
        }

        return true;
    }

    function performClick() {
        var caseElement = document.getElementById("case");

        if (!caseElement || !isGameReady()) {
            return false;
        }

        caseElement.click();
        clickCount += 1;

        var countElement = document.getElementById("acClickCount");
        if (countElement) {
            countElement.textContent = clickCount.toLocaleString();
        }

        return true;
    }

    function nextDelay() {
        var base = clamp(Number(state.interval) || defaults.interval, 50, 10000);
        var variance = clamp(Number(state.variance) || 0, 0, 100);

        if (!variance) {
            return base;
        }

        var multiplier = 1 + ((Math.random() * 2 - 1) * (variance / 100));
        return Math.max(50, Math.round(base * multiplier));
    }

    function scheduleNext() {
        if (!state.enabled) {
            timer = null;
            return;
        }

        timer = window.setTimeout(function () {
            if (state.enabled) {
                for (var i = 0; i < state.burst; i += 1) {
                    if (!performClick()) {
                        break;
                    }
                }
            }

            scheduleNext();
        }, nextDelay());
    }

    function start() {
        if (state.enabled) {
            return;
        }

        state.enabled = true;
        saveState();
        updateUI();
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

    function updateSettingsFromUI() {
        state.interval = clamp(Math.round(getNumber("acInterval", defaults.interval)), 50, 10000);
        state.burst = clamp(Math.round(getNumber("acBurst", defaults.burst)), 1, 50);
        state.variance = clamp(Math.round(getNumber("acVariance", defaults.variance)), 0, 100);
        state.autoStart = document.getElementById("acAutoStart").checked;
        saveState();

        document.getElementById("acInterval").value = state.interval;
        document.getElementById("acBurst").value = state.burst;
        document.getElementById("acVariance").value = state.variance;
    }

    function updateUI() {
        var panel = document.getElementById("caseClickerAutoclicker");
        var button = document.getElementById("acToggle");

        if (!panel || !button) {
            return;
        }

        panel.classList.toggle("active", state.enabled);
        button.textContent = state.enabled ? "STOP AUTOCLICKER" : "START AUTOCLICKER";
        button.classList.toggle("running", state.enabled);

        var status = document.getElementById("acStatus");
        if (status) {
            status.textContent = state.enabled ? "RUNNING" : "STOPPED";
        }

        var hotkey = document.getElementById("acHotkey");
        if (hotkey && !hotkeyCapture) {
            hotkey.textContent = state.hotkey || "None";
        }
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
                '<div>' +
                    '<div class="acTitle">AUTOCLICKER</div>' +
                    '<div class="acSubtitle">Built into CaseClicker</div>' +
                '</div>' +
                '<button type="button" id="acMinimize" class="acIconButton" aria-label="Minimize">−</button>' +
            '</div>' +
            '<div class="acBody">' +
                '<div class="acStatusRow">' +
                    '<span>Status</span>' +
                    '<strong id="acStatus">STOPPED</strong>' +
                '</div>' +
                '<button type="button" id="acToggle" class="acMainButton">START AUTOCLICKER</button>' +
                '<div class="acGrid">' +
                    '<label>Delay (ms)' +
                        '<input id="acInterval" type="number" min="50" max="10000" step="10">' +
                    '</label>' +
                    '<label>Burst clicks' +
                        '<input id="acBurst" type="number" min="1" max="50" step="1">' +
                    '</label>' +
                    '<label>Random variance (%)' +
                        '<input id="acVariance" type="number" min="0" max="100" step="1">' +
                    '</label>' +
                    '<label class="acCheckbox">' +
                        '<input id="acAutoStart" type="checkbox">' +
                        ' Auto-start on load' +
                    '</label>' +
                '</div>' +
                '<div class="acHotkeyRow">' +
                    '<span>Start/stop hotkey</span>' +
                    '<button type="button" id="acHotkey" class="acHotkeyButton"></button>' +
                '</div>' +
                '<div class="acBottomRow">' +
                    '<span>Autoclicks this session: <strong id="acClickCount">0</strong></span>' +
                    '<button type="button" id="acClickNow" class="acSmallButton">CLICK NOW</button>' +
                '</div>' +
                '<div class="acHint">The autoclicker waits for the normal case screen before clicking, so it does not spam clicks through an open reward window.</div>' +
            '</div>';

        document.body.appendChild(panel);

        document.getElementById("acInterval").value = state.interval;
        document.getElementById("acBurst").value = state.burst;
        document.getElementById("acVariance").value = state.variance;
        document.getElementById("acAutoStart").checked = state.autoStart;

        document.getElementById("acToggle").addEventListener("click", toggle);

        document.getElementById("acClickNow").addEventListener("click", function () {
            performClick();
        });

        ["acInterval", "acBurst", "acVariance", "acAutoStart"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", updateSettingsFromUI);
            document.getElementById(id).addEventListener("input", updateSettingsFromUI);
        });

        document.getElementById("acMinimize").addEventListener("click", function () {
            panel.classList.toggle("collapsed");
            this.textContent = panel.classList.contains("collapsed") ? "+" : "−";
        });

        document.getElementById("acHotkey").addEventListener("click", function () {
            hotkeyCapture = true;
            this.textContent = "PRESS A KEY...";
            this.classList.add("listening");
        });

        document.addEventListener("keydown", function (event) {
            if (hotkeyCapture) {
                event.preventDefault();
                event.stopPropagation();

                if (event.key === "Escape") {
                    hotkeyCapture = false;
                } else {
                    state.hotkey = event.key.length === 1
                        ? event.key.toUpperCase()
                        : event.key;
                    hotkeyCapture = false;
                    saveState();
                }

                updateUI();
                return;
            }

            if (event.key === state.hotkey) {
                var target = event.target;
                var tag = target && target.tagName ? target.tagName.toLowerCase() : "";

                if (tag === "input" || tag === "textarea" || tag === "select") {
                    return;
                }

                event.preventDefault();
                toggle();
            }
        });

        updateUI();

        if (state.autoStart) {
            window.setTimeout(start, 500);
        }
    }

    function init() {
        buildUI();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();