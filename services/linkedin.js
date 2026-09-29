import { getProfile } from "../parsers/profile.js";
import { getAbout } from "../parsers/about.js";
import { getExperience } from "../parsers/experience.js";
import { getEducation } from "../parsers/education.js";
import { getSkills } from "../parsers/skills.js";
import { getLanguages } from "../parsers/languages.js";

export async function parseLinkedInProfile() {

    return {

        profile: getProfile(),

        about: getAbout(),

        experience: getExperience(),

        education: getEducation(),

        skills: getSkills(),

        languages: getLanguages()

    };

}