const { classHP } = require('../healthCalc');
const { Tools } = require('../StoryAPI/tools');

// Player Stats
const baseStats = [10, 10, 10, 10, 10, 10];
const stats = baseStats.map(() => Math.floor(Math.random() * 11) + 10);
const initialStats = [...stats];
let level = 1;
let XP = 0;
let MAXXP = 1500;
const initialMAXXP = MAXXP;
const claimedMilestones = new Set();
const defaultAppearance = { theme: 'default', mode: 'default', panelsHidden: false };
const appearance = { ...defaultAppearance };

const QUIZBANK_API = 'https://quizbank.yorktechapps.com/api';
const MASTERY_COURSE_IDS = [10, 2];
const masteryColors = [
    '#1a1a1a', '#2b2b2b', '#3c3c3c', '#4d4d4d', '#5e5e5e', '#6f6f6f', '#7a7a7a', '#8b8b8b',
    '#7a6f6f', '#635050', '#614b4b', '#746767', '#615252', '#4b3d3d'
];
const masteryCourseSets = [];
const defaultMasteryCourseSets = [];

// Fetch Quizbank JSON Data
async function fetchQuizbankJson(path) {
    const response = await fetch(`${QUIZBANK_API}${path}`, {
        headers: { Accept: 'application/json' }
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Quizbank request failed (${response.status}): ${text || response.statusText}`);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Quizbank returned invalid JSON: ${error.message}`);
    }
}

// Initialize Mastery Course Sets
async function initializeMasteryCourseSets() {
    const courses = await fetchQuizbankJson('/course');
    if (!Array.isArray(courses)) throw new Error('Quizbank course list was not an array.');
    const selectedCourses = MASTERY_COURSE_IDS.map(id => {
        const course = courses.find(item => Number(item.id) === id);
        if (!course) throw new Error(`Quizbank course ${id} was not found.`);
        return course;
    });
    const courseSets = await Promise.all(selectedCourses.map(async course => {
        const details = await fetchQuizbankJson(`/course/${course.id}`);
        if (!Array.isArray(details.units)) {
            throw new Error(`Quizbank course ${course.id} did not include units.`);
        }
        const units = [...details.units]
            .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
        return {
            id: Number(course.id),
            name: details.name || course.name,
            sections: units.map((unit, index) => ({
                id: unit.id,
                name: unit.name,
                completion: 0,
                color: masteryColors[index % masteryColors.length],
                current: Number(course.id) === MASTERY_COURSE_IDS[0] && index === 0
            }))
        };
    }));
    masteryCourseSets.splice(0, masteryCourseSets.length, ...courseSets);
    defaultMasteryCourseSets.splice(0, defaultMasteryCourseSets.length, ...JSON.parse(JSON.stringify(courseSets)));
    return masteryCourseSets;
}

// Get the current mastery unit (course and section)
function getCurrentMasteryUnit() {
    for (const course of masteryCourseSets) {
        const section = course.sections.find(unit => unit.current);
        if (section) return { course, section };
    }
    return null;
}

// Set the current mastery unit (course and section)
function setCurrentMasteryUnit(courseId, unitId) {
    const selectedCourse = masteryCourseSets.find(course => Number(course.id) === Number(courseId));
    const selectedSection = selectedCourse?.sections.find(section => Number(section.id) === Number(unitId));
    if (!selectedCourse || !selectedSection) return null;

    for (const course of masteryCourseSets) {
        for (const section of course.sections) section.current = section === selectedSection;
    }
    return { course: selectedCourse, section: selectedSection };
}

// Fetch a question for the current mastery course
async function fetchQuestionForCurrentCourse() {
    const current = getCurrentMasteryUnit();
    if (!current) throw new Error('There are no remaining mastery units.');
    const questions = await fetchQuizbankJson(`/course/${current.course.id}?pick=1`);
    if (!Array.isArray(questions) || !questions.length) {
        throw new Error(`Quizbank returned no questions for ${current.course.name}.`);
    }
    const question = questions[0];
    if (!question.prompt || !Array.isArray(question.answers) || !question.answers.length) {
        throw new Error('Quizbank returned a question with an invalid format.');
    }
    const correctIndex = Number(question.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= question.answers.length) {
        throw new Error('Quizbank returned a question with an invalid correct answer.');
    }
    return {
        id: String(question.id),
        prompt: question.prompt,
        answers: question.answers.map((answer, index) => ({ id: String(index), text: String(answer) })),
        correctAnswerId: String(correctIndex),
        courseId: current.course.id,
        courseName: current.course.name,
        unitId: current.section.id,
        unitName: current.section.name
    };
}

// Record a correct answer for the current mastery unit
function recordCorrectMasteryAnswer() {
    const current = getCurrentMasteryUnit();
    if (!current) return null;
    current.section.completion = Math.min(100, current.section.completion + 4);
    const completed = current.section.completion === 100;
    let next = null;
    if (completed) {
        current.section.current = false;
        const allUnits = masteryCourseSets.flatMap(course => course.sections.map(section => ({ course, section })));
        const currentIndex = allUnits.findIndex(unit => unit.section === current.section);
        next = allUnits[currentIndex + 1] || null;
        if (next) next.section.current = true;
    }
    const active = next || current;
    return {
        completed,
        completion: current.section.completion,
        unitId: current.section.id,
        unitName: current.section.name,
        courseId: current.course.id,
        courseName: current.course.name,
        nextUnit: next ? { id: next.section.id, name: next.section.name, courseId: next.course.id, courseName: next.course.name } : null,
        currentUnit: next ? { id: next.section.id, name: next.section.name, courseId: next.course.id, courseName: next.course.name, completion: next.section.completion } : !completed ? {
            id: active.section.id,
            name: active.section.name,
            courseId: active.course.id,
            courseName: active.course.name,
            completion: active.section.completion
        } : null
    };
}

// Initialize Character Data
const campaignClass = 'Barbarian';
const initialClassStats = classHP.find(characterClass => characterClass.name === campaignClass);

function getMaxHPForLevel(targetLevel = level, className = campaignClass) {
    const selectedClass = classHP.find(item => item.name === className) || initialClassStats;
    if (!selectedClass) return 0;
    const constitutionModifier = (stats[2] - 10) / 2;
    return Math.floor((selectedClass.default + constitutionModifier)
        + ((targetLevel - 1) * (constitutionModifier + selectedClass.perLevel)));
}

const gameState = {
    tools: Tools.map(tool => ({ ...tool, equipped: Boolean(tool.equipped) })),
    charName: 'Carter',
    charClass: campaignClass,
    charRace: 'Elvish',
    charOrigin: '',
    HP: getMaxHPForLevel()
};
    const initialGameState = JSON.parse(JSON.stringify(gameState));

// +XP
function addExperience(experience) {
    const previousLevel = level;
    XP += experience;
    while (XP >= MAXXP) {
        XP -= MAXXP;
        MAXXP = Math.floor(MAXXP * 1.2);
        level += 1;
    }
    if (level > previousLevel) {
        gameState.HP = getMaxHPForLevel(level, gameState.charClass);
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
    gameState.HP = getMaxHPForLevel(level, characterClass);
    return true;
}

function updateAppearance({ theme, mode, panelsHidden } = {}) {
    const validThemes = ['default', 'red', 'green', 'blue'];
    const validModes = ['default', 'light'];
    if (theme !== undefined && !validThemes.includes(theme)) return false;
    if (mode !== undefined && !validModes.includes(mode)) return false;
    if (panelsHidden !== undefined && typeof panelsHidden !== 'boolean') return false;
    if (theme !== undefined) appearance.theme = theme;
    if (mode !== undefined) appearance.mode = mode;
    if (panelsHidden !== undefined) appearance.panelsHidden = panelsHidden;
    return true;
}

function getSnapshot() {
    return {
        gameState: {
            ...gameState,
            tools: gameState.tools.map(tool => ({ ...tool }))
        },
        level,
        XP,
        MAXXP,
        stats: [...stats],
        appearance: { ...appearance },
        claimedMilestones: [...claimedMilestones],
        masteryCourseSets: JSON.parse(JSON.stringify(masteryCourseSets))
    };
}

function loadSnapshot(snapshot) {
    if (!snapshot) {
        Object.assign(gameState, JSON.parse(JSON.stringify(initialGameState)));
        gameState.tools = initialGameState.tools.map(tool => ({ ...tool }));
        level = 1;
        XP = 0;
        MAXXP = initialMAXXP;
        stats.splice(0, stats.length, ...initialStats);
        Object.assign(appearance, defaultAppearance);
        claimedMilestones.clear();
        masteryCourseSets.splice(0, masteryCourseSets.length, ...JSON.parse(JSON.stringify(defaultMasteryCourseSets)));
        return;
    }
    Object.assign(gameState, snapshot.gameState || {});
    if (Array.isArray(snapshot.gameState?.tools)) gameState.tools = snapshot.gameState.tools;
    level = Number(snapshot.level) || 1;
    XP = Number(snapshot.XP) || 0;
    MAXXP = Number(snapshot.MAXXP) || 1500;
    const savedStats = Array.isArray(snapshot.stats) && snapshot.stats.length === stats.length
        ? snapshot.stats.map(Number)
        : initialStats;
    stats.splice(0, stats.length, ...savedStats.map((score, index) => (
        Number.isInteger(score) && score >= 1 && score <= 30 ? score : initialStats[index]
    )));
    appearance.theme = ['default', 'red', 'green', 'blue'].includes(snapshot.appearance?.theme)
        ? snapshot.appearance.theme
        : defaultAppearance.theme;
    appearance.mode = ['default', 'light'].includes(snapshot.appearance?.mode)
        ? snapshot.appearance.mode
        : defaultAppearance.mode;
    appearance.panelsHidden = typeof snapshot.appearance?.panelsHidden === 'boolean'
        ? snapshot.appearance.panelsHidden
        : defaultAppearance.panelsHidden;
    gameState.HP = getMaxHPForLevel(level, gameState.charClass);
    claimedMilestones.clear();
    (snapshot.claimedMilestones || []).forEach(milestone => claimedMilestones.add(Number(milestone)));
    if (Array.isArray(snapshot.masteryCourseSets) && snapshot.masteryCourseSets.length) {
        masteryCourseSets.splice(0, masteryCourseSets.length, ...snapshot.masteryCourseSets);
    }
}

module.exports = {
    addExperience,
    claimedMilestones,
    characterClasses: classHP.map(characterClass => characterClass.name),
    gameState,
    fetchQuestionForCurrentCourse,
    getSnapshot,
    getProgression,
    getCurrentMasteryUnit,
    initializeMasteryCourseSets,
    loadSnapshot,
    masteryCourseSets,
    recordCorrectMasteryAnswer,
    setCurrentMasteryUnit,
    stats,
    appearance,
    updateAppearance,
    updateCharacter
};