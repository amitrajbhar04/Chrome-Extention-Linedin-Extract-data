// =====================================================================
// LinkedIn Candidate Parser — Chrome Extension Version
// Added: Profile Image, Improved Email & Phone Extraction
// =====================================================================

console.clear();
console.log("=================================");
console.log("LinkedIn Candidate Parser Started");
console.log("=================================");

// -------------------------
// Helper: promise-based wait
// -------------------------
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------
// Helper: consecutive duplicate lines hata do
// -------------------------
function dedupeLines(lines) {
    const out = [];
    for (const line of lines) {
        if (out.length === 0 || out[out.length - 1] !== line) {
            out.push(line);
        }
    }
    return out;
}

// -------------------------
// Helper: Clean text extraction
// -------------------------
function cleanText(text) {
    return text?.trim().replace(/\s+/g, " ") || "";
}

// -------------------------
// Helper: Extract email from text (Improved)
// -------------------------
function extractEmail(text) {
    if (!text) return null;
    // More comprehensive email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (matches) {
        // Filter out common false positives
        const validEmails = matches.filter(email => 
            !email.includes('linkedin.com') && 
            !email.includes('example.com') &&
            !email.includes('test.com') &&
            !email.includes('noreply')
        );
        return validEmails.length > 0 ? validEmails[0] : null;
    }
    return null;
}

// -------------------------
// Helper: Extract phone from text (Improved)
// -------------------------
function extractPhone(text) {
    if (!text) return null;
    
    // Remove common non-phone text
    const cleanText = text.replace(/[^\d\+\s\-\(\)\.]/g, ' ');
    
    // Match various phone formats
    const patterns = [
        // International format: +91 98765 43210
        /\+\d{1,3}[\s\-]?\(?\d{2,3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g,
        // With country code: +91-98765-43210
        /\+\d{1,3}-\d{3,5}-\d{4,6}/g,
        // Indian phone numbers: 98765 43210, 98765-43210
        /\b[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}\b/g,
        // US/International: (123) 456-7890, 123-456-7890
        /\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g,
        // Simple 10 digit numbers
        /\b\d{10}\b/g
    ];
    
    for (const pattern of patterns) {
        const matches = cleanText.match(pattern);
        if (matches) {
            // Return first valid match
            const phone = matches[0].replace(/[\s\-\(\)]/g, '').trim();
            if (phone.length >= 10) {
                return matches[0];
            }
        }
    }
    return null;
}

// -------------------------
// Helper: Extract profile image
// -------------------------
function extractProfileImage() {
    console.log("🖼️ Extracting profile image...");
    
    // Try multiple selectors for profile image
    const selectors = [
        '.pv-top-card-profile-picture img',
        '.profile-picture img',
        '.top-card-layout__profile-image img',
        '[data-test-profile-photo] img',
        '.profile-photo-edit__preview img',
        'img[class*="profile"]',
        'img[class*="avatar"]',
        'img[class*="photo"]',
        '.pv-entity__image img',
        'img[alt*="profile"]',
        'img[alt*="photo"]',
        'img[src*="profile"]'
    ];
    
    for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src) {
            // Validate it's a profile image (not icon or logo)
            const src = img.src;
            if (src.includes('media.licdn.com') || 
                src.includes('profile') || 
                (img.alt && img.alt.toLowerCase().includes('profile'))) {
                console.log(`✅ Profile image found: ${src}`);
                return src;
            }
        }
    }
    
    // Try to find by image size (profile images are usually > 100px)
    const allImages = document.querySelectorAll('img');
    for (const img of allImages) {
        if (img.src && img.src.includes('media.licdn.com')) {
            // Check if it's a square image (profile photos are usually square)
            const isSquare = img.naturalWidth === img.naturalHeight || 
                           (img.width && img.height && Math.abs(img.width - img.height) < 20);
            if (isSquare && img.naturalWidth > 80) {
                console.log(`✅ Profile image found by size: ${img.src}`);
                return img.src;
            }
        }
    }
    
    console.log("⚠️ No profile image found");
    return null;
}

// -------------------------
// PUBLIC LAYOUT PARSERS
// -------------------------
function parsePublicBasicDetails() {
    const name = document.querySelector(".top-card-layout__title")?.textContent.trim();
    if (!name) return null;

    const headline = document.querySelector(".top-card-layout__headline")?.textContent.trim() || "";
    const location = document.querySelector(".profile-info-subheader span")?.textContent.trim() || "";

    return { name, headline, location };
}

function parsePublicExperience() {
    const section = document.querySelector('section[data-section="experience"]');
    if (!section) return null;

    const items = Array.from(section.querySelectorAll("li.experience-item"));
    if (items.length === 0) return null;

    return items.map(item => {
        const title = item.querySelector(".experience-item__title")?.textContent.trim() || "";
        const company = item.querySelector(".experience-item__subtitle")?.textContent.trim() || "";
        const metaItems = Array.from(item.querySelectorAll(".experience-item__meta-item"))
            .map(el => el.textContent.trim().replace(/\s+/g, " "))
            .filter(Boolean);

        return {
            title,
            company,
            duration: metaItems[0] || "",
            location: metaItems[1] || "",
            description: metaItems.slice(2).join(" ") || ""
        };
    });
}

function parsePublicGenericSection(dataSectionName) {
    const section = document.querySelector(`section[data-section="${dataSectionName}"]`);
    if (!section) return null;

    let items = Array.from(section.querySelectorAll("li"));
    if (items.length === 0) {
        items = Array.from(section.querySelectorAll('[class*="item"]'));
    }
    if (items.length === 0) return null;

    return items
        .map(item => {
            const lines = item.innerText.split("\n").map(s => s.trim()).filter(Boolean);
            return dedupeLines(lines);
        })
        .filter(arr => arr.length > 0);
}

// -------------------------
// CONTACT INFO EXTRACTION (IMPROVED)
// -------------------------
async function extractContactInfo() {
    console.log("📧 Attempting to extract contact information...");
    
    let email = null;
    let phone = null;
    let contactModalOpened = false;

    // Strategy 1: Check URL for contact-info overlay
    if (window.location.href.includes('/overlay/contact-info/')) {
        console.log("📄 On contact-info page, extracting directly...");
        const contactInfo = extractFromContactInfoPage();
        if (contactInfo.email || contactInfo.phone) {
            return contactInfo;
        }
    }

    // Strategy 2: Try to find contact info in the profile without clicking
    const contactInfoInProfile = findContactInfoInProfile();
    if (contactInfoInProfile) {
        console.log("✅ Found contact info in profile:", contactInfoInProfile);
        email = contactInfoInProfile.email;
        phone = contactInfoInProfile.phone;
        if (email || phone) {
            return { email, phone, modalOpened: false };
        }
    }

    // Strategy 3: Try to click the "Contact info" button and open modal
    try {
        const result = await openContactModalAndExtract();
        if (result && (result.email || result.phone)) {
            email = result.email || email;
            phone = result.phone || phone;
            contactModalOpened = true;
        }
    } catch (error) {
        console.log("⚠️ Could not open contact modal:", error);
    }

    // Strategy 4: If still no contact info, try to navigate to contact-info page
    if (!email && !phone) {
        console.log("🔄 Trying to navigate to contact-info page...");
        const result = await navigateToContactInfoPage();
        if (result && (result.email || result.phone)) {
            email = result.email || email;
            phone = result.phone || phone;
        }
    }

    // Strategy 5: Try to find contact info in any visible text
    if (!email && !phone) {
        const contactInfo = findContactInfoInVisibleText();
        email = contactInfo.email || email;
        phone = contactInfo.phone || phone;
    }

    console.log(`📧 Email: ${email || 'Not found'}`);
    console.log(`📱 Phone: ${phone || 'Not found'}`);

    return { email, phone, modalOpened: contactModalOpened };
}

function extractFromContactInfoPage() {
    let email = null;
    let phone = null;
    
    // Extract email from the page
    const emailElements = document.querySelectorAll('a[href*="mailto:"]');
    for (const el of emailElements) {
        const href = el.getAttribute('href');
        if (href && href.includes('mailto:')) {
            const extractedEmail = href.replace('mailto:', '').split('?')[0];
            if (extractedEmail && extractedEmail.includes('@') && !extractedEmail.includes('linkedin.com')) {
                email = extractedEmail;
                break;
            }
        }
    }
    
    // If no mailto link, look for email in text
    if (!email) {
        const text = document.body.innerText;
        const extractedEmail = extractEmail(text);
        if (extractedEmail && !extractedEmail.includes('linkedin.com')) {
            email = extractedEmail;
        }
    }
    
    // Extract phone from the page
    const phoneElements = document.querySelectorAll('a[href*="tel:"]');
    for (const el of phoneElements) {
        const href = el.getAttribute('href');
        if (href && href.includes('tel:')) {
            const extractedPhone = href.replace('tel:', '');
            if (extractedPhone && extractedPhone.length >= 10) {
                phone = extractedPhone;
                break;
            }
        }
    }
    
    // If no tel link, look for phone in text
    if (!phone) {
        const text = document.body.innerText;
        const extractedPhone = extractPhone(text);
        if (extractedPhone) {
            phone = extractedPhone;
        }
    }
    
    return { email, phone };
}

async function navigateToContactInfoPage() {
    console.log("🔄 Attempting to navigate to contact-info page...");
    
    const currentUrl = window.location.href;
    const profileUrl = currentUrl.split('/overlay/')[0];
    const contactInfoUrl = `${profileUrl}/overlay/contact-info/`;
    
    console.log(`📍 Navigating to: ${contactInfoUrl}`);
    
    try {
        // Open in new tab to avoid losing current state
        const newTab = window.open(contactInfoUrl, '_blank');
        if (newTab) {
            // Wait for page to load
            await wait(3000);
            
            // Try to extract from the new tab
            const contactInfo = extractFromContactInfoPage();
            newTab.close();
            
            if (contactInfo.email || contactInfo.phone) {
                console.log("✅ Found contact info in contact-info page:", contactInfo);
                return contactInfo;
            }
        }
    } catch (error) {
        console.log("⚠️ Could not navigate to contact-info page:", error);
    }
    
    return null;
}

function findContactInfoInProfile() {
    let email = null;
    let phone = null;

    // Look for email in various elements
    const selectors = [
        'a[href*="mailto:"]',
        '[class*="email"]',
        '[class*="contact"]',
        '[class*="info"]',
        '[data-test-email]',
        '.pv-contact-info__email',
        '.pv-contact-info__phone'
    ];

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            const text = cleanText(el.textContent);
            const href = el.getAttribute('href') || '';
            
            // Check if it's a mailto link
            if (href.includes('mailto:')) {
                const extractedEmail = href.replace('mailto:', '').split('?')[0];
                if (extractedEmail && extractedEmail.includes('@') && !extractedEmail.includes('linkedin.com')) {
                    email = extractedEmail;
                }
            }
            
            // Check text for email
            if (!email) {
                const extractedEmail = extractEmail(text);
                if (extractedEmail && !extractedEmail.includes('linkedin.com')) {
                    email = extractedEmail;
                }
            }
            
            // Check text for phone
            if (!phone) {
                const extractedPhone = extractPhone(text);
                if (extractedPhone) {
                    phone = extractedPhone;
                }
            }
        }
    }

    // Check all text content for email and phone
    if (!email || !phone) {
        const bodyText = document.body.innerText;
        if (!email) {
            const extractedEmail = extractEmail(bodyText);
            if (extractedEmail && !extractedEmail.includes('linkedin.com')) {
                email = extractedEmail;
            }
        }
        if (!phone) {
            const extractedPhone = extractPhone(bodyText);
            if (extractedPhone) {
                phone = extractedPhone;
            }
        }
    }

    return { email, phone };
}

async function openContactModalAndExtract() {
    console.log("🔄 Attempting to open contact info modal...");
    
    // Find the "Contact info" button
    const contactButton = findContactButton();
    if (!contactButton) {
        console.log("⚠️ Contact info button not found");
        return null;
    }

    // Click the button
    console.log("🖱️ Clicking contact info button...");
    contactButton.click();
    await wait(2000);

    // Look for the modal
    const modal = findContactModal();
    if (!modal) {
        console.log("⚠️ Contact modal not found after clicking");
        return null;
    }

    // Extract data from modal
    const modalText = modal.innerText;
    console.log("📄 Modal content found, extracting data...");
    
    let email = extractEmail(modalText);
    let phone = extractPhone(modalText);
    
    // Also check for specific elements in modal
    const modalElements = modal.querySelectorAll('a, p, span, div');
    for (const el of modalElements) {
        const text = cleanText(el.textContent);
        const href = el.getAttribute('href') || '';
        
        if (href.includes('mailto:') && !email) {
            email = href.replace('mailto:', '').split('?')[0];
        }
        
        if (!email) {
            const extractedEmail = extractEmail(text);
            if (extractedEmail && !extractedEmail.includes('linkedin.com')) {
                email = extractedEmail;
            }
        }
        
        if (!phone) {
            const extractedPhone = extractPhone(text);
            if (extractedPhone) {
                phone = extractedPhone;
            }
        }
    }

    // Close the modal
    const closeButton = modal.querySelector('button[aria-label*="close"], button[aria-label*="dismiss"], [class*="close"]');
    if (closeButton) {
        closeButton.click();
        await wait(500);
    }

    return { email, phone };
}

function findContactButton() {
    // Try multiple selectors for the contact button
    const selectors = [
        '[data-control-name="contact_see_more"]',
        '[data-control-name="contact_see_more"] button',
        '[class*="contact"] button',
        '[class*="contact"] a',
        '.pv-contact-info-button',
        '[data-test-contact-info-button]',
        'button[aria-label*="Contact"]',
        'a[href*="/overlay/contact-info/"]'
    ];

    // Search by text content
    const allButtons = document.querySelectorAll('button, a');
    for (const button of allButtons) {
        const text = button.textContent.toLowerCase().trim();
        if (text === 'contact info' || text === 'contact' || text.includes('contact info')) {
            return button;
        }
    }

    // Search by selectors
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }

    return null;
}

function findContactModal() {
    // Try multiple selectors for the modal
    const selectors = [
        '[role="dialog"]',
        '[class*="modal"]',
        '[class*="overlay"]',
        '[class*="popup"]',
        '[class*="contact"] [role="dialog"]',
        '.pv-contact-modal'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            // Check if it contains contact information
            const text = element.innerText.toLowerCase();
            if (text.includes('email') || text.includes('phone') || text.includes('mobile')) {
                return element;
            }
        }
    }

    return null;
}

function findContactInfoInVisibleText() {
    let email = null;
    let phone = null;
    
    // Get all visible text
    const allElements = document.querySelectorAll('p, span, a, div');
    for (const el of allElements) {
        // Check if element is visible
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        if (isVisible) {
            const text = cleanText(el.textContent);
            
            if (!email) {
                const extractedEmail = extractEmail(text);
                if (extractedEmail && !extractedEmail.includes('linkedin.com')) {
                    email = extractedEmail;
                }
            }
            
            if (!phone) {
                const extractedPhone = extractPhone(text);
                if (extractedPhone) {
                    phone = extractedPhone;
                }
            }
        }
    }
    
    return { email, phone };
}

// -------------------------
// LOGGED-IN (SDUI) LAYOUT PARSERS
// -------------------------
const TITLE_STYLE_MARKER = "7a8b2218";
const DATE_LIKE_REGEX = /\b(19|20)\d{2}\b|present/i;

function findSectionByHeading(headingText) {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, .section-title, [class*='section-header']"));
    const heading = headings.find(h => {
        const text = h.textContent.trim();
        return text === headingText || text.includes(headingText);
    });
    if (!heading) {
        const section = document.querySelector(`section[data-section="${headingText.toLowerCase()}"]`);
        if (section) return section;
        return null;
    }
    return heading.closest("section") || heading.closest("[class*='section']") || heading.parentElement;
}

function findEntryContainer(titleP) {
    let container = titleP.parentElement;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (container && attempts < maxAttempts) {
        const paragraphs = Array.from(container.querySelectorAll("p"));
        if (paragraphs.length >= 2) {
            const hasDate = paragraphs.some(p => p !== titleP && DATE_LIKE_REGEX.test(p.textContent));
            const hasMultipleLines = paragraphs.length >= 2;
            if (hasDate || hasMultipleLines) {
                return container;
            }
        }
        container = container.parentElement;
        attempts++;
    }
    return titleP.parentElement;
}

function extractEntriesByTitleMarker(section) {
    if (!section) return [];
    
    const selectors = [
        `p[style*="${TITLE_STYLE_MARKER}"]`,
        'p[style*="font-weight: 600"]',
        'p[style*="font-weight: bold"]',
        '[class*="title"] p',
        '[class*="heading"]'
    ];
    
    let titleMarkers = [];
    for (const selector of selectors) {
        const found = Array.from(section.querySelectorAll(selector));
        if (found.length > 0) {
            titleMarkers = found;
            break;
        }
    }
    
    if (titleMarkers.length === 0) {
        const allPs = Array.from(section.querySelectorAll("p"));
        titleMarkers = allPs.filter(p => {
            const text = p.textContent.trim();
            return text.length > 0 && text.length < 100 && 
                   !DATE_LIKE_REGEX.test(text) && 
                   !/^\d+$/.test(text);
        });
    }
    
    console.log(`  -> ${titleMarkers.length} title-marker(s) found in section`);

    const entries = [];
    for (const titleP of titleMarkers) {
        const container = findEntryContainer(titleP);
        const texts = Array.from(container.querySelectorAll("p, span, div[class*='description']"))
            .map(el => cleanText(el.textContent))
            .filter(Boolean);
        
        const titleText = cleanText(titleP.textContent);
        const filteredTexts = texts.filter(t => t !== titleText);
        const combined = [titleText, ...filteredTexts];
        const deduped = dedupeLines(combined);
        
        if (deduped.length > 0) {
            entries.push(deduped);
        }
    }
    
    return entries;
}

function parseSDUIEducationV2() {
    const section = findSectionByHeading("Education");
    if (section) {
        const entries = extractEntriesByTitleMarker(section);
        if (entries.length > 0) {
            return entries.map(p => ({
                school: p[0] || "",
                degree: p.length > 1 ? p[1] : "",
                duration: p.length > 2 ? p[2] : "",
                ...(p.length > 3 ? { details: p.slice(3).join(" • ") } : {})
            }));
        }
    }
    
    const eduSection = document.querySelector('[componentkey*="EducationTopLevelSection"]');
    if (eduSection) {
        const entries = getEntriesFromSDUISection(eduSection);
        if (entries.length > 0) {
            return entries.map(p => ({
                school: p[0] || "",
                degree: p.length > 1 ? p[1] : "",
                duration: p.length > 2 ? p[2] : ""
            }));
        }
    }
    
    const eduItems = document.querySelectorAll('[class*="education"], [data-section="education"] li, [class*="school"]');
    if (eduItems.length > 0) {
        const entries = [];
        for (const item of eduItems) {
            const texts = Array.from(item.querySelectorAll("p, span, div"))
                .map(el => cleanText(el.textContent))
                .filter(Boolean);
            if (texts.length > 0) {
                entries.push(dedupeLines(texts));
            }
        }
        if (entries.length > 0) {
            return entries.map(p => ({
                school: p[0] || "",
                degree: p.length > 1 ? p[1] : "",
                duration: p.length > 2 ? p[2] : ""
            }));
        }
    }
    
    return null;
}

function parseSDUISkillsV2() {
    const section = findSectionByHeading("Skills");
    if (section) {
        const titleMarkers = Array.from(section.querySelectorAll(`p[style*="${TITLE_STYLE_MARKER}"]`));
        if (titleMarkers.length > 0) {
            return dedupeLines(titleMarkers.map(p => cleanText(p.textContent)).filter(Boolean));
        }
        
        const skillItems = section.querySelectorAll('[class*="skill"], [class*="badge"], [class*="tag"], [class*="pill"]');
        if (skillItems.length > 0) {
            return dedupeLines(Array.from(skillItems).map(el => cleanText(el.textContent)).filter(Boolean));
        }
        
        const allPs = Array.from(section.querySelectorAll("p, span, div"));
        const skills = dedupeLines(allPs.map(el => cleanText(el.textContent)).filter(Boolean));
        if (skills.length > 0) {
            return skills;
        }
    }
    
    const skillsSection = document.querySelector('[componentkey*="SkillsTopLevelSection"]');
    if (skillsSection) {
        const entries = getEntriesFromSDUISection(skillsSection);
        if (entries.length > 0) {
            return entries.map(p => p[0]).filter(Boolean);
        }
        
        const skillItems = skillsSection.querySelectorAll('[class*="skill"], [class*="badge"], [class*="tag"]');
        if (skillItems.length > 0) {
            return dedupeLines(Array.from(skillItems).map(el => cleanText(el.textContent)).filter(Boolean));
        }
    }
    
    const skillsItems = document.querySelectorAll('[class*="skills"], [data-section="skills"] li, [class*="skill"]');
    if (skillsItems.length > 0) {
        const skills = [];
        for (const item of skillsItems) {
            const text = cleanText(item.textContent);
            if (text && text.length < 50 && !DATE_LIKE_REGEX.test(text)) {
                skills.push(text);
            }
        }
        if (skills.length > 0) {
            return dedupeLines(skills);
        }
    }
    
    return null;
}

function parseSDUIExperienceV2() {
    const section = findSectionByHeading("Experience");
    if (!section) {
        const expSection = document.querySelector('[componentkey*="ExperienceTopLevelSection"]');
        if (expSection) {
            const entries = getEntriesFromSDUISection(expSection);
            if (entries.length > 0) {
                return entries.map(p => ({
                    title: p[0] || "",
                    company: p.length > 1 ? p[1] : "",
                    duration: p.length > 2 ? p[2] : "",
                    location: p.length > 3 ? p[3] : ""
                }));
            }
        }
        return null;
    }
    const entries = extractEntriesByTitleMarker(section);
    if (entries.length === 0) return null;

    return entries.map(p => ({
        title: p[0] || "",
        company: p.length > 1 ? p[1] : "",
        duration: p.length > 2 ? p[2] : "",
        location: p.length > 3 ? p[3] : ""
    }));
}

async function autoScrollToLoadAllSections() {
    const anchors = Array.from(document.querySelectorAll('[componentkey*="top_anchor"]'));

    console.log(`Found ${anchors.length} section anchor(s):`,
        anchors.map(a => a.getAttribute("componentkey")));

    for (const anchor of anchors) {
        anchor.scrollIntoView({ behavior: "instant", block: "center" });
        await wait(900);
    }

    if (anchors.length === 0) {
        for (let i = 0; i < 15; i++) {
            window.scrollBy(0, 800);
            await wait(400);
        }
    }

    await wait(800);
    window.scrollTo(0, 0);
    await wait(500);

    const sectionKeys = Array.from(document.querySelectorAll('[componentkey*="TopLevelSection"]'))
        .map(el => el.getAttribute("componentkey"));
    console.log("Sections found after scroll (logged-in layout):", sectionKeys);
}

function findSectionByComponentKey(keyword) {
    return document.querySelector(`[componentkey*="${keyword}TopLevelSection"]`);
}

function getEntriesFromSDUISection(section) {
    if (!section) return [];
    const itemNodes = section.querySelectorAll('[componentkey^="entity-collection-item"], [class*="item"], li');
    const entries = [];

    itemNodes.forEach(item => {
        const texts = Array.from(item.querySelectorAll("p, span, div"))
            .map(p => cleanText(p.textContent))
            .filter(t => t.length > 0);
        const deduped = dedupeLines(texts);
        if (deduped.length > 0) entries.push(deduped);
    });

    return entries;
}

function parseSDUIExperience() {
    const section = findSectionByComponentKey("Experience");
    const entries = getEntriesFromSDUISection(section);
    return entries.map(p => ({
        title: p[0] || "",
        company: p.length > 1 ? p[1] : "",
        duration: p.length > 2 ? p[2] : "",
        location: p.length > 3 ? p[3] : ""
    }));
}

function parseSDUIEducation() {
    const section = findSectionByComponentKey("Education");
    const entries = getEntriesFromSDUISection(section);
    return entries.map(p => ({
        school: p[0] || "",
        degree: p.length > 1 ? p[1] : "",
        duration: p.length > 2 ? p[2] : ""
    }));
}

function parseSDUISkills() {
    const section = findSectionByComponentKey("Skills");
    const entries = getEntriesFromSDUISection(section);
    return entries.map(p => p[0]).filter(Boolean);
}

function findLocation(lines, startIndex, name, headline) {
    const skipWords = [
        "message", "connect", "follow", "following", "more",
        "pending", "mutual connection",
        "recommend", "save", "invite"
    ];

    for (let i = startIndex; i < Math.min(startIndex + 8, lines.length); i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        const isSkip = skipWords.some(w => lower.includes(w));
        const isConnectionsCount = /connections?$|followers?$/i.test(line);
        const isDuplicateIdentity =
            line === name || line === headline || lower.includes((name || "").toLowerCase());

        if (!isSkip && !isConnectionsCount && !isDuplicateIdentity) {
            return line;
        }
    }
    return "";
}

function parseSDUIBasicDetails() {
    const lines = document.body.innerText
        .split("\n")
        .map(x => x.trim())
        .filter(x => x.length > 0);

    const profileIndex = lines.findIndex(
        item => item === document.title.replace(" | LinkedIn", "")
    );

    if (profileIndex === -1) return { name: "", headline: "", location: "" };

    const name = lines[profileIndex];
    const headline = lines[profileIndex + 1] || "";
    const location = findLocation(lines, profileIndex + 2, name, headline);

    return { name, headline, location };
}

// -------------------------
// MAIN EXTRACTION FUNCTION
// -------------------------
async function extractCandidateData() {
    await wait(1500);

    const candidate = {
        name: "",
        headline: "",
        location: "",
        email: "",
        phone: "",
        profileImage: "",
        experience: [],
        education: [],
        skills: [],
        profileUrl: window.location.href
    };

    console.log("🔍 Starting extraction...");

    // ---- Basic details ----
    const publicBasics = parsePublicBasicDetails();
    if (publicBasics) {
        console.log("✅ Public layout detected for basic details.");
        Object.assign(candidate, publicBasics);
    } else {
        console.log("🔄 Using SDUI layout for basic details...");
        Object.assign(candidate, parseSDUIBasicDetails());
    }

    // ---- Profile Image ----
    const profileImage = extractProfileImage();
    candidate.profileImage = profileImage || "";
    console.log(`🖼️ Profile Image: ${candidate.profileImage || 'Not found'}`);

    // ---- Contact Info ----
    const contactInfo = await extractContactInfo();
    candidate.email = contactInfo.email || "";
    candidate.phone = contactInfo.phone || "";
    console.log(`📧 Email: ${candidate.email || 'Not found'}`);
    console.log(`📱 Phone: ${candidate.phone || 'Not found'}`);

    // ---- Experience ----
    let experience = parsePublicExperience();
    let scrolledAlready = false;

    if (experience) {
        console.log("✅ Public layout detected for experience.");
    } else {
        console.log("🔄 Trying SDUI for experience...");
        experience = parseSDUIExperienceV2();

        if (!experience || experience.length === 0) {
            console.log("🔄 Scrolling to load experience...");
            await autoScrollToLoadAllSections();
            scrolledAlready = true;
            experience = parseSDUIExperienceV2() || parseSDUIExperience();
        }
    }
    candidate.experience = experience || [];
    console.log(`📊 Experience entries found: ${candidate.experience.length}`);

    // ---- Education ----
    let education = parsePublicGenericSection("education");
    if (education && education.length > 0) {
        console.log("✅ Public layout detected for education.");
        education = education.map(lines => ({
            school: lines[0] || "",
            degree: lines.length > 1 ? lines[1] : "",
            duration: lines.length > 2 ? lines[2] : ""
        }));
    } else {
        console.log("🔄 Trying SDUI for education...");
        education = parseSDUIEducationV2() || parseSDUIEducation();

        if ((!education || education.length === 0) && !scrolledAlready) {
            console.log("🔄 Scrolling to load education...");
            await autoScrollToLoadAllSections();
            scrolledAlready = true;
            education = parseSDUIEducationV2() || parseSDUIEducation();
        }
        
        if (!education || education.length === 0) {
            console.log("🔄 Trying aggressive education extraction...");
            education = extractEducationFromDOM();
        }
    }
    candidate.education = education || [];
    console.log(`📊 Education entries found: ${candidate.education.length}`);

    // ---- Skills ----
    let skills = parsePublicGenericSection("skills");
    if (skills && skills.length > 0) {
        console.log("✅ Public layout detected for skills.");
        skills = skills.map(arr => arr[0]).filter(Boolean);
    } else {
        console.log("🔄 Trying SDUI for skills...");
        skills = parseSDUISkillsV2() || parseSDUISkills();

        if ((!skills || skills.length === 0) && !scrolledAlready) {
            console.log("🔄 Scrolling to load skills...");
            await autoScrollToLoadAllSections();
            skills = parseSDUISkillsV2() || parseSDUISkills();
        }
        
        if (!skills || skills.length === 0) {
            console.log("🔄 Trying aggressive skills extraction...");
            skills = extractSkillsFromDOM();
        }
    }
    candidate.skills = skills || [];
    console.log(`📊 Skills found: ${candidate.skills.length}`);

    console.log("========================");
    console.log("✅ Extracted Candidate Data:", candidate);
    console.log("========================");

    // Send data to background script
    chrome.runtime.sendMessage({
        type: 'CANDIDATE_DATA',
        data: candidate
    });

    // Store data for popup access
    chrome.storage.local.set({ candidateData: candidate }, function() {
        console.log('✅ Candidate data stored in chrome storage');
    });

    return candidate;
}

// -------------------------
// AGGRESSIVE EXTRACTION METHODS
// -------------------------

function extractEducationFromDOM() {
    const educationEntries = [];
    const educationKeywords = ['school', 'university', 'college', 'institute', 'education', 'degree', 'bachelor', 'master', 'phd', 'mba'];
    
    const allSections = document.querySelectorAll('section, div[class*="section"], div[role="section"]');
    
    for (const section of allSections) {
        const sectionText = section.textContent.toLowerCase();
        const hasEducationKeyword = educationKeywords.some(keyword => sectionText.includes(keyword));
        
        if (hasEducationKeyword) {
            const items = section.querySelectorAll('li, [class*="item"], [class*="entry"]');
            for (const item of items) {
                const texts = Array.from(item.querySelectorAll('p, span, div'))
                    .map(el => cleanText(el.textContent))
                    .filter(t => t.length > 0 && t.length < 200);
                
                if (texts.length > 0) {
                    const combinedText = texts.join(' ').toLowerCase();
                    const isEducation = educationKeywords.some(keyword => combinedText.includes(keyword));
                    
                    if (isEducation) {
                        educationEntries.push({
                            school: texts[0] || "",
                            degree: texts.length > 1 ? texts[1] : "",
                            duration: texts.length > 2 ? texts[2] : ""
                        });
                    }
                }
            }
        }
    }
    
    return educationEntries;
}

function extractSkillsFromDOM() {
    const skills = new Set();
    
    const skillSelectors = [
        '[class*="skill"]',
        '[class*="badge"]',
        '[class*="tag"]',
        '[class*="pill"]',
        '[class*="chip"]',
        '[data-section="skills"] li',
        '[class*="skills"] [class*="item"]'
    ];
    
    for (const selector of skillSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            const text = cleanText(el.textContent);
            if (text && text.length < 50 && !DATE_LIKE_REGEX.test(text)) {
                skills.add(text);
            }
        }
    }
    
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
    for (const heading of headings) {
        if (heading.textContent.trim() === 'Skills' || heading.textContent.includes('Skills')) {
            const container = heading.parentElement;
            const items = container.querySelectorAll('p, span, [class*="item"], li');
            for (const item of items) {
                const text = cleanText(item.textContent);
                if (text && text.length < 50 && !DATE_LIKE_REGEX.test(text)) {
                    skills.add(text);
                }
            }
        }
    }
    
    return Array.from(skills).filter(Boolean);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
        extractCandidateData().then(data => {
            sendResponse({ success: true, data: data });
        });
        return true;
    }
});

// Auto-extract when page loads
if (document.readyState === 'complete') {
    setTimeout(extractCandidateData, 2000);
} else {
    window.addEventListener('load', () => {
        setTimeout(extractCandidateData, 2000);
    });
}