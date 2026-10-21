const fs = require('fs/promises');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'storyParts');

async function loadStoryDocument(directoryPath = DEFAULT_PATH) {
    try {
        const fileNames = (await fs.readdir(directoryPath))
            .filter(fileName => /^storyPart\d+\.md$/i.test(fileName))
            .sort((left, right) => {
                const leftNumber = Number(left.match(/\d+/)?.[0]);
                const rightNumber = Number(right.match(/\d+/)?.[0]);
                return leftNumber - rightNumber;
            });

        return Promise.all(fileNames.map(async fileName => ({
            number: Number(fileName.match(/\d+/)?.[0]),
            fileName,
            text: (await fs.readFile(path.join(directoryPath, fileName), 'utf8')).trim()
        })));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw new Error(`Unable to read story parts: ${error.message}`);
    }
}

module.exports = { loadStoryDocument };
