const { Tools } = require('../StoryAPI/tools.js');
const { classHP } = require('../healthCalc.js');

const mastery = [
    {
        name: 'General Information and Concepts',
        completion: 24,
        color: '#f1ece2',
        current: false
    },
    {
        name: 'Ethics, Legal Compliance, and Security',
        completion: 87,
        color: '#6b625e',
        current: false
    },
    {
        name: 'Analyze Programming Problems, Manage Projects, and Create Flowchart Solutions',
        completion: 54,
        color: '#b8cfd0',
        current: false
    },
    {
        name: 'Design Program Solutions',
        completion: 12,
        color: '#5a617a',
        current: false
    },
    {
        name: 'Code Programs',
        completion: 67,
        color: '#828e6f',
        current: true
    },
    {
        name: 'Test Programs',
        completion: 24,
        color: '#5d5f37',
        current: false
    },
    {
        name: 'Maintain Programs and Implement Change Management Procedures',
        completion: 19,
        color: '#d3a7a8',
        current: false
    },
    {
        name: 'Complete User Documentation and Technical Writing',
        completion: 62,
        color: '#b1756a',
        current: false
    }
];

function calculateHP(className, stats, level) {
    const selectedClass = classHP.find(c => c.name === className) || classHP[0];
    const conModifier = (stats[2] - 10) / 2;
    const base = selectedClass?.default ?? 0;
    const perLevel = selectedClass?.perLevel ?? 0;
    return (base + conModifier) + (((level - 1) * conModifier) + ((level - 1) * perLevel));
}

function createAppState() {
    const stats = [10, 10, 20, 3, 7, 14];
    const currentClass = 'Barbarian';
    const state = {
        stats,
        campaignClass: currentClass,
        level: 1,
        tools: Tools.map(tool => ({ ...tool })),
        mastery: mastery.map(item => ({ ...item })),
        gold: 0,
        charName: 'Carter',
        charClass: currentClass,
        charRace: 'Elvish',
        charOrigin: '',
        HP: 0
    };
    state.HP = calculateHP(state.charClass, state.stats, state.level);
    return state;
}

module.exports = {
    createAppState,
    calculateHP
};
