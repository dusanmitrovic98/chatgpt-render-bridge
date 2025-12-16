// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const API_URL = "http://localhost:5000";

    if (request.action === "poll") {
        fetch(`${API_URL}/poll`)
            .then(res => res.json())
            .then(data => sendResponse({success: true, data: data}))
            .catch(err => sendResponse({success: false, error: err.toString()}));
        return true; 
    }
    
    if (request.action === "reply") {
        fetch(`${API_URL}/reply`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(request.data)
        })
        .then(() => sendResponse({success: true}))
        .catch(err => sendResponse({success: false}));
        return true;
    }

    // NEW: Handle Partial Stream Chunks
    if (request.action === "chunk") {
        fetch(`${API_URL}/chunk`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(request.data)
        })
        .then(() => sendResponse({success: true}))
        .catch(err => sendResponse({success: false}));
        return true;
    }
});