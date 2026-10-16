const fs = require('fs/promises');
const path = require('path');
const mammoth = require('mammoth');

const DEFAULT_PATH = path.join(__dirname, '..', 'story.docx');
const MAX_CHARS = Number(process.env.STORY_CONTEXT_MAX_CHARS) || 30000;

async function loadStoryDocument(filePath = DEFAULT_PATH) {
    try {
        await fs.access(filePath);
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value.trim().slice(0, MAX_CHARS);
    } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw new Error(`Unable to read story document: ${error.message}`);
    }
}

module.exports = { loadStoryDocument };
