/* CaseClicker automatic case-spending / inventory cleanup menu */
(function () {
    "use strict";

    var STORAGE_KEY = "caseClicker.caseAutomation.v1";
    var DEFAULTS = {
        keybind: "KeyX",
        deleteBelow: 1.00,
        minimumMoney: 100.00,
        menuKey: "KeyO"
    };

    var state = loadState();
    var menuVisible = false;
    var running = false;
    var timer = null;
    var rightAltPressed = false;
    var keybindCapture = false;

    function loadState() {
        var saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch (e) {}

        return {
            keybind: typeof saved.keybind === "string" ? saved.keybind : DEFAULTS.keybind,
            deleteBelow: isFinite(saved.deleteBelow) ? Number(saved.deleteBelow) : DEFAULTS.deleteBelow,
            minimumMoney: isFinite(saved.minimumMoney) ? Number(saved.minimumMoney) : DEFAULTS.minimumMoney,
            menuKey: DEFAULTS.menuKey
        };
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function moneyNow() {
        return window.caseClickerAutomation
            ? window.caseClickerAutomation.getMoney()
            : parseFloat(String($("#money").text()).replace(/[^0-9.-]/g, "")) || 0;
    }

    function updateStatus(message) {
        var status = document.getElementById("caseAutomationStatus");
        if (status) {
            status.textContent = message;
        }
    }

    function runOnce() {
        if (!window.caseClickerAutomation) {
            updateStatus("Game automation hooks are not ready.");
            return false;
        }

        var money = moneyNow();

        if (money < state.minimumMoney) {
            updateStatus("Waiting for $" + state.minimumMoney.toFixed(2) + " — wallet: $" + money.toFixed(2));
            return false;
        }

        /* Clean cheap skins first so a full inventory cannot block case opening. */
        var removed = window.caseClickerAutomation.deleteItemsBelow(state.deleteBelow);
        var opened = window.caseClickerAutomation.spendAllMoney();

        updateStatus(
            "Ran: " + opened + " cases opened, " +
            removed + " camo deleted. Wallet: $" + moneyNow().toFixed(2)
        );

        return opened > 0 || removed > 0;
    }

    function schedule() {
        if (!running) {
            return;
        }

        runOnce();
        timer = setTimeout(schedule, 300);
    }

    function setRunning(value) {
        running = value;

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        var button = document.getElementById("caseAutomationRun");
        if (button) {
            button.textContent = running ? "STOP AUTOMATION" : "START AUTOMATION";
            button.classList.toggle("running", running);
        }

        if (running) {
            updateStatus("Automation enabled — waiting for minimum wallet.");
            schedule();
        } else {
            updateStatus("Automation stopped.");
        }
    }

    function buildMenu() {
        var panel = document.createElement("div");
        panel.id = "caseAutomationMenu";
        panel.className = "case-automation-menu";
        panel.innerHTML = [
            '<div class="automationTitle">CASE AUTOMATION</div>',
            '<div class="automationHint">Right Alt + O to show/hide</div>',
            '<label class="automationRow">',
                '<span>X — ACTION KEY</span>',
                '<input id="caseAutomationKey" type="text" maxlength="12" autocomplete="off">',
            '</label>',
            '<label class="automationRow">',
                '<span>Y — DELETE CAMO UNDER ($)</span>',
                '<input id="caseAutomationDelete" type="number" min="0" step="0.01">',
            '</label>',
            '<label class="automationRow">',
                '<span>Z — MINIMUM MONEY ($)</span>',
                '<input id="caseAutomationMinimum" type="number" min="0" step="0.01">',
            '</label>',
            '<button id="caseAutomationRun" type="button">START AUTOMATION</button>',
            '<div id="caseAutomationStatus" class="automationStatus">Automation stopped.</div>'
        ].join("");

        document.body.appendChild(panel);

        document.getElementById("caseAutomationKey").value = state.keybind.replace(/^Key/, "");
        document.getElementById("caseAutomationDelete").value = state.deleteBelow.toFixed(2);
        document.getElementById("caseAutomationMinimum").value = state.minimumMoney.toFixed(2);

        document.getElementById("caseAutomationRun").addEventListener("click", function () {
            setRunning(!running);
        });

        document.getElementById("caseAutomationKey").addEventListener("focus", function () {
            keybindCapture = true;
            this.value = "PRESS A KEY";
        });

        document.getElementById("caseAutomationKey").addEventListener("blur", function () {
            keybindCapture = false;
            this.value = state.keybind.replace(/^Key/, "");
        });

        document.getElementById("caseAutomationDelete").addEventListener("change", function () {
            state.deleteBelow = Math.max(0, parseFloat(this.value) || 0);
            this.value = state.deleteBelow.toFixed(2);
            saveState();
        });

        document.getElementById("caseAutomationMinimum").addEventListener("change", function () {
            state.minimumMoney = Math.max(0, parseFloat(this.value) || 0);
            this.value = state.minimumMoney.toFixed(2);
            saveState();
        });
    }

    function toggleMenu() {
        menuVisible = !menuVisible;
        var panel = document.getElementById("caseAutomationMenu");
        if (panel) {
            panel.classList.toggle("visible", menuVisible);
        }
    }

    document.addEventListener("keydown", function (event) {
        if (event.code === "AltRight") {
            rightAltPressed = true;
            return;
        }

        if (rightAltPressed && event.code === "KeyO") {
            event.preventDefault();
            toggleMenu();
            return;
        }

        if (keybindCapture) {
            if (event.code === "Escape") {
                keybindCapture = false;
                var input = document.getElementById("caseAutomationKey");
                if (input) {
                    input.value = state.keybind.replace(/^Key/, "");
                }
                return;
            }

            if (event.code && event.code !== "ShiftLeft" && event.code !== "ShiftRight" &&
                event.code !== "ControlLeft" && event.code !== "ControlRight" &&
                event.code !== "AltLeft" && event.code !== "AltRight") {
                state.keybind = event.code;
                keybindCapture = false;
                var keyInput = document.getElementById("caseAutomationKey");
                if (keyInput) {
                    keyInput.value = event.code.replace(/^Key/, "");
                }
                saveState();
                event.preventDefault();
            }
            return;
        }

        if (event.code === state.keybind && !event.repeat &&
            !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
            event.preventDefault();
            runOnce();
        }
    });

    document.addEventListener("keyup", function (event) {
        if (event.code === "AltRight") {
            rightAltPressed = false;
        }
    });

    document.addEventListener("DOMContentLoaded", buildMenu);
})();