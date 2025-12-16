// CONTENT SCRIPT V2 (Message Passing)

(function() {
    'use strict';

    // --- VISIBILITY HACKS ---
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true });
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

    // --- UI INIT ---
    function initUI() {
        if (document.getElementById('gpt-bridge-ui')) return;
        const ui = document.createElement('div');
        ui.id = 'gpt-bridge-ui';
        // PURPLE BADGE = Version 2.0 (Background Worker Mode)
        ui.style.cssText = "position:fixed; top:10px; right:10px; padding:8px 12px; background:#8e44ad; color:#fff; z-index:99999; font-family:monospace; font-size:12px; border-radius:4px; opacity:0.8; pointer-events:none;";
        ui.innerText = "EXT V2.0"; 
        document.body.appendChild(ui);
        tryStartAudio();
        startPolling();
    }

    function updateStatus(msg, color="#8e44ad") {
        const ui = document.getElementById('gpt-bridge-ui');
        if (ui) {
            ui.innerText = msg;
            ui.style.backgroundColor = color;
        }
    }

    // --- AUDIO ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const silence = audioCtx.createBuffer(1, 1000, 44100);
    const source = audioCtx.createBufferSource();
    source.buffer = silence;
    source.loop = true;
    source.connect(audioCtx.destination);
    
    function tryStartAudio() {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
            try { source.start(0); } catch(e){}
        }
    }
    document.addEventListener('click', tryStartAudio, {once:true});

    // --- LOGIC ---
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function killPopups() {
        const closeBtns = document.querySelectorAll('button[aria-label="Close"]');
        closeBtns.forEach(btn => btn.click());
        const links = document.querySelectorAll('a');
        for (let l of links) {
            if (l.innerText.includes('Stay logged out')) {
                l.click();
                return true;
            }
        }
        return false;
    }

    async function runJob(prompt) {
        updateStatus("🤖 WORKING", "#d35400");
        tryStartAudio();
        killPopups();
        
        let editor = document.querySelector('#prompt-textarea');
        if (!editor) {
            for(let i=0; i<10; i++) {
                await sleep(200);
                editor = document.querySelector('#prompt-textarea');
                if(editor) break;
            }
        }
        if (!editor) {
            updateStatus("ERR: NO INPUT", "red");
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, prompt);
        await sleep(500);

        const btn = document.querySelector('[data-testid="send-button"]') || 
                    document.querySelector('button[aria-label="Send prompt"]');
        
        if (btn && !btn.disabled) btn.click();
        else {
             editor.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', charCode: 13
            }));
        }

        updateStatus("⏳ READING", "#2980b9");
        monitorResponse();
    }

    function monitorResponse() {
        let stableChecks = 0;
        let lastLen = 0;
        let checks = 0;
        const initialMsgCount = document.querySelectorAll('.markdown').length; 

        const timer = setInterval(() => {
            checks++;
            if (killPopups()) checks = 0;
            if (checks > 120) { clearInterval(timer); window.location.reload(); return; }

            document.body.offsetHeight; 

            const msgs = document.querySelectorAll('.markdown');
            if (msgs.length <= initialMsgCount) return; 

            const currentText = msgs[msgs.length - 1].innerText;
            if (!currentText.trim()) return;

            if (currentText.length === lastLen) stableChecks++;
            else { stableChecks = 0; lastLen = currentText.length; }

            if (stableChecks >= 5) {
                clearInterval(timer);
                sendResult(currentText);
            }
        }, 500);
    }

    // --- MESSAGE PASSING (Fixes CSP) ---
    function sendResult(text) {
        updateStatus("🚀 SENDING", "#27ae60");
        chrome.runtime.sendMessage({ action: "reply", data: { answer: text } }, (response) => {
            window.location.href = "https://chatgpt.com/?new=" + Date.now();
        });
    }

    function checkQueue() {
        killPopups();
        chrome.runtime.sendMessage({ action: "poll" }, (response) => {
            if (response && response.success && response.data.has_work) {
                clearInterval(pollInterval);
                runJob(response.data.prompt);
            }
        });
    }

    let pollInterval;
    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(checkQueue, 2000);
        updateStatus("🟣 LISTENING", "#8e44ad");
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initUI();
    } else {
        document.addEventListener('DOMContentLoaded', initUI);
    }
})();