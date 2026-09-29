console.clear();

console.log("=================================");
console.log("LinkedIn Candidate Parser Started");
console.log("=================================");

setTimeout(() => {

    const candidate = {
        name: "",
        headline: "",
        location: ""
    };

    // -------------------------
    // Read all visible text
    // -------------------------

    const lines = document.body.innerText
        .split("\n")
        .map(x => x.trim())
        .filter(x => x.length > 0);

    // Debug
    console.log(lines);

    // -------------------------
    // Find profile section
    // -------------------------

    const profileIndex = lines.findIndex(
        item => item === document.title.replace(" | LinkedIn", "")
    );

    if (profileIndex !== -1) {

        candidate.name = lines[profileIndex];

        if (lines[profileIndex + 1]) {
            candidate.headline = lines[profileIndex + 1];
        }

        if (lines[profileIndex + 2]) {
            candidate.location = lines[profileIndex + 2];
        }

    }
    console.log("========================");
    console.log("candidate",candidate);
    console.log("========================");

},3000);