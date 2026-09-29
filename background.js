// Background service worker for the extension

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CANDIDATE_DATA') {
        console.log('Received candidate data:', request.data);
        
        // You can send this data to your backend server if needed
        // Example: sendToServer(request.data);
        
        sendResponse({ success: true });
    }
});

// Optional: Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('ElineHR Extension installed');
});