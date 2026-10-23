const courseId = -1;
const courseName = 'JavaScript';
const unitId = -1;
const unitName = 'JavaScript Fundamentals';

const questions = [
    {
        id: 'javascript-001',
        prompt: 'Which keyword declares a block-scoped variable that cannot be reassigned?',
        answers: ['var', 'let', 'const', 'static'],
        correctIndex: 2
    },
    {
        id: 'javascript-002',
        prompt: 'What is the result of 3 === "3" in JavaScript?',
        answers: ['true', 'false', '3', 'A TypeError'],
        correctIndex: 1
    },
    {
        id: 'javascript-003',
        prompt: 'Which array method creates a new array by transforming every element?',
        answers: ['forEach()', 'map()', 'find()', 'some()'],
        correctIndex: 1
    },
    {
        id: 'javascript-004',
        prompt: 'What does an async function always return?',
        answers: ['A Promise', 'An array', 'A callback', 'undefined'],
        correctIndex: 0
    },
    {
        id: 'javascript-005',
        prompt: 'Which operator returns its right-hand value only when the left-hand value is null or undefined?',
        answers: ['||', '&&', '??', '?.'],
        correctIndex: 2
    },
    {
        id: 'javascript-006',
        prompt: 'What does Array.prototype.filter() return?',
        answers: [
            'The first matching element',
            'A new array containing elements that pass its test',
            'The number of matching elements',
            'The original array, sorted'
        ],
        correctIndex: 1
    },
    {
        id: 'javascript-007',
        prompt: 'Which statement about const is correct?',
        answers: [
            'A const object cannot have its properties changed',
            'A const binding cannot be reassigned',
            'const is function-scoped',
            'const variables are automatically global'
        ],
        correctIndex: 1
    },
    {
        id: 'javascript-008',
        prompt: 'What is a closure?',
        answers: [
            'A function bundled with access to its surrounding lexical scope',
            'A loop that runs until a condition is false',
            'A method that closes a browser tab',
            'A class with no constructor'
        ],
        correctIndex: 0
    },
    {
        id: 'javascript-009',
        prompt: 'Which syntax safely accesses a possibly missing nested property?',
        answers: ['user->profile', 'user.profile!', 'user?.profile', 'user::profile'],
        correctIndex: 2
    },
    {
        id: 'javascript-010',
        prompt: 'What does the spread syntax [...items] create when items is an array?',
        answers: [
            'A shallow copy of the array',
            'A deeply cloned array',
            'A sorted version of the array',
            'A reference that cannot be changed'
        ],
        correctIndex: 0
    },
    {
        id: 'javascript-011',
        prompt: 'Which method converts a JSON-formatted string into a JavaScript value?',
        answers: ['JSON.stringify()', 'JSON.parse()', 'JSON.convert()', 'JSON.decode()'],
        correctIndex: 1
    },
    {
        id: 'javascript-012',
        prompt: 'What does the await keyword do inside an async function?',
        answers: [
            'Waits for a Promise to settle before continuing that function',
            'Stops all JavaScript execution',
            'Turns a value into an array',
            'Runs the next statement in a new thread'
        ],
        correctIndex: 0
    },
    {
        id: 'javascript-013',
        prompt: 'What does typeof null evaluate to in JavaScript?',
        answers: ['"null"', '"undefined"', '"object"', '"boolean"'],
        correctIndex: 2
    },
    {
        id: 'javascript-014',
        prompt: 'Which array method returns the first element that satisfies a test function?',
        answers: ['filter()', 'find()', 'map()', 'reduce()'],
        correctIndex: 1
    },
    {
        id: 'javascript-015',
        prompt: 'In a Promise chain, what does .then(callback) do?',
        answers: [
            'Registers a callback to run after the Promise fulfills',
            'Immediately cancels the Promise',
            'Converts the Promise to a string',
            'Runs the callback synchronously before the Promise settles'
        ],
        correctIndex: 0
    },
    {
        id: 'javascript-016',
        prompt: 'Which syntax extracts a property into a variable from an object?',
        answers: [
            'const { name } = user;',
            'const name := user;',
            'const name <- user;',
            'const user(name);'
        ],
        correctIndex: 0
    }
];

module.exports = { courseId, courseName, unitId, unitName, questions };
