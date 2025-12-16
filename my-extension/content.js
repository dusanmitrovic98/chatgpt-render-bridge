// CONTENT SCRIPT V2.1 (Streaming Support)

(function() {
    'use strict';

    // --- VISIBILITY HACKS (Unchanged) ---
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);

    // --- UI INIT ---
    function initUI() {
        if (document.getElementById('gpt-bridge-ui')) return;
        const ui = document.createElement('div');
        ui.id = 'gpt-bridge-ui';
        ui.style.cssText = "position:fixed; top:10px; right:10px; padding:8px 12px; background:#8e44ad; color:#fff; z-index:99999; font-family:monospace; font-size:12px; border-radius:4px; opacity:0.8; pointer-events:none;";
        ui.innerText = "BRIDGE READY"; 
        document.body.appendChild(ui);
        startPolling();
    }

    function updateStatus(msg, color="#8e44ad") {
        const ui = document.getElementById('gpt-bridge-ui');
        if (ui) { ui.innerText = msg; ui.style.backgroundColor = color; }
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function killPopups() {
        document.querySelectorAll('button[aria-label="Close"]').forEach(btn => btn.click());
    }

    // --- MAIN LOGIC ---

    async function runJob(job) {
        updateStatus(job.stream ? "🌊 STREAMING" : "🤖 WORKING", "#d35400");
        killPopups();
        
        // 1. Find Input
        let editor = document.querySelector('#prompt-textarea');
        if (!editor) {
            updateStatus("ERR: NO INPUT", "red");
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        // 2. Type Prompt
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, job.prompt);
        await sleep(300);

        // 3. Click Send
        const btn = document.querySelector('[data-testid="send-button"]') || document.querySelector('button[aria-label="Send prompt"]');
        if (btn) btn.click();
        else editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', charCode: 13 }));

        // 4. Read Response
        monitorResponse(job);
    }

    function monitorResponse(job) {
        let stableChecks = 0;
        let lastFullText = ""; // Full text seen so far
        let lastReportedLen = 0; // Length we have already sent to server
        let checks = 0;
        
        // Capture the initial number of markdown blocks to identify the NEW one
        const initialCount = document.querySelectorAll('.markdown').length; 

        const timer = setInterval(() => {
            checks++;
            killPopups();
            
            // Failsafe: Reload if stuck for too long (60s)
            if (checks > 120) { clearInterval(timer); window.location.reload(); return; }

            // Get all message bubbles
            const msgs = document.querySelectorAll('.markdown');
            
            // Wait until a new bubble appears
            if (msgs.length <= initialCount) return; 

            // Get the text of the *last* bubble (the one generating now)
            const currentEl = msgs[msgs.length - 1];
            const currentText = currentEl.innerText;

            // --- STREAMING LOGIC ---
            if (job.stream) {
                // If text grew, send the delta
                if (currentText.length > lastReportedLen) {
                    const delta = currentText.substring(lastReportedLen);
                    lastReportedLen = currentText.length;
                    
                    // Send chunk to background -> server
                    chrome.runtime.sendMessage({ 
                        action: "chunk", 
                        data: { chunk: delta } 
                    });
                }
            }

            // --- STABILITY CHECK (Determine when done) ---
            if (currentText.length === lastFullText.length && currentText.trim().length > 0) {
                stableChecks++;
            } else {
                stableChecks = 0;
                lastFullText = currentText;
            }

            // If text hasn't changed for 1.5 seconds (3 checks * 500ms), assume done
            if (stableChecks >= 3) {
                clearInterval(timer);
                finishJob(job, currentText);
            }
        }, 50);
    }

    function finishJob(job, finalAnswer) {
        updateStatus("🚀 DONE", "#27ae60");
        
        // If streaming, we just say "We are done", server handles the rest.
        // If blocking, we send the whole answer.
        const payload = job.stream ? { status: "DONE" } : { answer: finalAnswer };

        chrome.runtime.sendMessage({ action: "reply", data: payload }, () => {
             // Reset page for next job
            window.location.href = "https://chatgpt.com/?new=" + Date.now();
        });
    }

    // --- POLLING LOOP ---
    function checkQueue() {
        chrome.runtime.sendMessage({ action: "poll" }, (response) => {
            if (response && response.success && response.data.has_work) {
                clearInterval(pollInterval);
                runJob(response.data); // Pass the whole job object (contains id, prompt, stream)
            }
        });
    }

    let pollInterval;
    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(checkQueue, 2000);
    }

    if (document.readyState === 'complete') initUI();
    else document.addEventListener('DOMContentLoaded', initUI);

})();