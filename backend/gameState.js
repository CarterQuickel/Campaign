const { classHP } = require('../healthCalc');
const { Tools } = require('../StoryAPI/tools');

// Player Stats
const stats = [10, 3, 20, 15, 7, 14];
let level = 1;
let XP = 0;
let MAXXP = 800;
const claimedMilestones = new Set();

// Course Units (PLACEHOLDER)
const mastery = {
    'Computer Programming NOCTI': [
        { name: 'General Information and Concepts', completion: 24, color: '#f1ece2', current: false },
        { name: 'Ethics, Legal Compliance, and Security', completion: 87, color: '#6b625e', current: false },
        { name: 'Analyze Programming Problems, Manage Projects, and Create Flowchart Solutions', completion: 54, color: '#b8cfd0', current: false },
        { name: 'Design Program Solutions', completion: 12, color: '#5a617a', current: false },
        { name: 'Code Programs', completion: 67, color: '#828e6f', current: false },
        { name: 'Test Programs', completion: 24, color: '#5d5f37', current: false },
        { name: 'Maintain Programs and Implement Change Management Procedures', completion: 19, color: '#d3a7a8', current: false },
        { name: 'Complete User Documentation and Technical Writing', completion: 62, color: '#b1756a', current: false }
    ],
    'CIW Javascript Specialist': [
        { name: 'Introduction to JavaScript', completion: 0, color: '#1a1a1a', current: false },
        { name: 'Working with Variables and Data in JavaScript', completion: 10, color: '#2b2b2b', current: false },
        { name: 'Functions, Methods, and Events in JavaScript', completion: 90, color: '#3c3c3c', current: false },
        { name: 'Debugging and Troubleshooting in JavaScript', completion: 15, color: '#4d4d4d', current: false },
        { name: 'Controlling Program Flow in JavaScript', completion: 0, color: '#5e5e5e', current: false },
        { name: 'The JavaScript Document Object Model (DOM)', completion: 0, color: '#6f6f6f', current: false },
        { name: 'JavaScript Language Objects', completion: 8, color: '#7a7a7a', current: false },
        { name: 'Custom JavaScript Objects', completion: 100, color: '#8b8b8b', current: true },
        { name: 'Changing HTML on the Fly', completion: 5, color: '#7a6f6f', current: false },
        { name: 'Developing Interactive Forms with JavaScript', completion: 98, color: '#635050', current: false },
        { name: 'JavaScript Security', completion: 12, color: '#614b4b', current: false },
        { name: 'JavaScript Libraries and Frameworks', completion: 38, color: '#746767', current: false },
        { name: 'JavaScript and AJAX', completion: 19, color: '#615252', current: false },
        { name: 'Introduction to Web APIs', completion: 70, color: '#4b3d3d', current: false }
    ]
};

// Game Mastery
const masteryCourseSets = Object.entries(mastery).map(([name, sections]) => ({ name, sections }));
const campaignClass = 'Barbarian';
const initialConstitutionModifier = (stats[2] - 10) / 2;
const initialClassStats = classHP.find(characterClass => characterClass.name === campaignClass);
const gameState = {
    gold: 0,
    tools: Tools.map(tool => ({ ...tool })),
    charName: 'Carter',
    charClass: campaignClass,
    charRace: 'Elvish',
    charOrigin: '',
    HP: (initialClassStats?.default + initialConstitutionModifier)
        + (((level - 1) * initialConstitutionModifier) + ((level - 1) * initialClassStats?.perLevel))
};

// +XP
function addExperience(experience) {
    XP += experience;
    while (XP >= MAXXP) {
        XP -= MAXXP;
        level += 1;
        MAXXP *= 2;
    }
}
function getProgression() {
    return { level, XP, MAXXP };
}

// Update Character Sheet
function updateCharacter({ name, origin, race, characterClass }) {
    const classStats = classHP.find(item => item.name === characterClass);
    if (!classStats) return false;
    gameState.charName = name;
    gameState.charOrigin = origin;
    gameState.charRace = race;
    gameState.charClass = characterClass;
    gameState.HP = classStats.default + ((level - 1) * classStats.perLevel);
    return true;
}

module.exports = {
    addExperience,
    claimedMilestones,
    gameState,
    getProgression,
    masteryCourseSets,
    stats,
    updateCharacter
};