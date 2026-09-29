// Popup JavaScript - Handles UI interaction and data display

document.addEventListener('DOMContentLoaded', function() {
    const extractBtn = document.getElementById('extractBtn');
    const loadingDiv = document.getElementById('loading');
    const profileDataDiv = document.getElementById('profileData');
    const copyBtn = document.getElementById('copyBtn');
    const statusDiv = document.getElementById('status');

    // Load stored data on popup open
    loadStoredData();

    // Extract button click handler
    extractBtn.addEventListener('click', function() {
        extractBtn.disabled = true;
        loadingDiv.classList.add('active');
        statusDiv.classList.remove('show');

        // Send message to content script to extract data
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const activeTab = tabs[0];
            if (!activeTab || !activeTab.url.includes('linkedin.com/in/')) {
                showError('Please open a LinkedIn profile page');
                loadingDiv.classList.remove('active');
                extractBtn.disabled = false;
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, { action: 'extractData' }, function(response) {
                loadingDiv.classList.remove('active');
                extractBtn.disabled = false;

                if (chrome.runtime.lastError) {
                    showError('Error: ' + chrome.runtime.lastError.message);
                    return;
                }

                if (response && response.success) {
                    displayCandidateData(response.data);
                    // Store the data for future use
                    chrome.storage.local.set({ candidateData: response.data });
                } else {
                    showError('Failed to extract data. Please try again.');
                }
            });
        });
    });

    // Copy button click handler
    copyBtn.addEventListener('click', function() {
        chrome.storage.local.get(['candidateData'], function(result) {
            if (result.candidateData) {
                const jsonString = JSON.stringify(result.candidateData, null, 2);
                navigator.clipboard.writeText(jsonString).then(() => {
                    statusDiv.textContent = '✅ Copied to clipboard!';
                    statusDiv.classList.add('show');
                    setTimeout(() => {
                        statusDiv.classList.remove('show');
                    }, 3000);
                }).catch(() => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = jsonString;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    statusDiv.textContent = '✅ Copied to clipboard!';
                    statusDiv.classList.add('show');
                    setTimeout(() => {
                        statusDiv.classList.remove('show');
                    }, 3000);
                });
            } else {
                statusDiv.textContent = '❌ No data to copy. Extract profile first.';
                statusDiv.classList.add('show');
                statusDiv.classList.add('error-status');
                setTimeout(() => {
                    statusDiv.classList.remove('show');
                    statusDiv.classList.remove('error-status');
                }, 3000);
            }
        });
    });

    function loadStoredData() {
        chrome.storage.local.get(['candidateData'], function(result) {
            if (result.candidateData) {
                displayCandidateData(result.candidateData);
            }
        });
    }

    function displayCandidateData(data) {
        if (!data) return;

        // Display basic info with profile image
        const basicContent = document.getElementById('basicContent');
        
        let avatarHtml = '';
        if (data.profileImage) {
            avatarHtml = `<img src="${data.profileImage}" alt="${data.name || 'Profile'}" onerror="this.style.display='none'">`;
        } else {
            avatarHtml = `<div class="placeholder">👤</div>`;
        }

        // Display contact info
        const emailDisplay = data.email ? 
            `<span class="email-value">${data.email}</span>` : 
            `<span class="not-found">Not available</span>`;
        
        const phoneDisplay = data.phone ? 
            `<span class="phone-value">${data.phone}</span>` : 
            `<span class="not-found">Not available</span>`;

        basicContent.innerHTML = `
            <div class="profile-avatar">
                ${avatarHtml}
                <div>
                    <div style="font-weight: 600; font-size: 16px; color: #1a1a1a;">${data.name || 'N/A'}</div>
                    <div style="font-size: 12px; color: #6c757d;">${data.headline || 'N/A'}</div>
                </div>
            </div>
            <div class="field"><span class="label">📍 Location:</span> <span class="value">${data.location || 'N/A'}</span></div>
            <div class="contact-info">
                <div class="field"><span class="label">📧 Email:</span> <span class="value">${emailDisplay}</span></div>
                <div class="field"><span class="label">📱 Phone:</span> <span class="value">${phoneDisplay}</span></div>
            </div>
            <div class="url-display">🔗 ${data.profileUrl || ''}</div>
        `;

        // Display experience
        const expContent = document.getElementById('experienceContent');
        if (data.experience && data.experience.length > 0) {
            expContent.innerHTML = data.experience.map(exp => `
                <div class="experience-item">
                    <div class="title">${exp.title || 'N/A'}</div>
                    <div class="company">${exp.company || 'N/A'}</div>
                    <div class="duration">${exp.duration || ''} ${exp.location ? '• ' + exp.location : ''}</div>
                    ${exp.description ? `<div style="font-size: 12px; color: #495057; margin-top: 4px;">${exp.description}</div>` : ''}
                </div>
            `).join('');
        } else {
            expContent.innerHTML = '<div class="no-data">No experience data available.</div>';
        }

        // Display education
        const eduContent = document.getElementById('educationContent');
        if (data.education && data.education.length > 0) {
            eduContent.innerHTML = data.education.map(edu => {
                if (typeof edu === 'object' && !Array.isArray(edu)) {
                    return `
                        <div class="education-item">
                            <div style="font-weight: 600; font-size: 13px;">${edu.school || 'N/A'}</div>
                            <div style="font-size: 12px; color: #0a66c2;">${edu.degree || ''}</div>
                            <div style="font-size: 11px; color: #6c757d;">${edu.duration || ''}</div>
                        </div>
                    `;
                } else {
                    const eduText = Array.isArray(edu) ? edu.join(' - ') : String(edu);
                    return `<div class="education-item" style="font-size: 13px;">${eduText}</div>`;
                }
            }).join('');
        } else {
            eduContent.innerHTML = '<div class="no-data">No education data available.</div>';
        }

        // Display skills
        const skillsContent = document.getElementById('skillsContent');
        if (data.skills && data.skills.length > 0) {
            skillsContent.innerHTML = data.skills.map(skill => 
                `<span class="skill-tag">${skill}</span>`
            ).join('');
        } else {
            skillsContent.innerHTML = '<div class="no-data">No skills data available.</div>';
        }
    }

    function showError(message) {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = '❌ ' + message;
        statusDiv.classList.add('show');
        statusDiv.classList.add('error-status');
        setTimeout(() => {
            statusDiv.classList.remove('show');
            statusDiv.classList.remove('error-status');
        }, 5000);
    }
});