// background.js - Handles network requests to bypass CSP
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "poll") {
        fetch("http://localhost:5000/poll")
            .then(res => res.json())
            .then(data => sendResponse({success: true, data: data}))
            .catch(err => sendResponse({success: false, error: err.toString()}));
        return true; // Keep channel open for async response
    }
    if (request.action === "reply") {
        fetch("http://localhost:5000/reply", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(request.data)
        })
        .then(() => sendResponse({success: true}))
        .catch(err => sendResponse({success: false, error: err.toString()}));
        return true;
    }
});