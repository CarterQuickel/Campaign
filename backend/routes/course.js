const express = require('express');
const QUIZBANK_API = 'https://quizbank.yorktechapps.com/api';

async function fetchQuizbankCourse(courseId) {
    const response = await fetch(`${QUIZBANK_API}/course/${courseId}`, {
        headers: { Accept: 'application/json' }
    });
    const text = await response.text();
    let data = null;
    if (response.ok) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            throw new Error(`Quizbank returned invalid JSON: ${error.message}`);
        }
    }
    return { response, text, data };
}

// Course Progress
function createCourseRouter(state) {
    const router = express.Router();
    router.post('/mastery/current', (req, res) => {
        const selected = state.setCurrentMasteryUnit(req.body?.courseId, req.body?.unitId);
        if (!selected) {
            return res.status(404).json({ success: false, message: 'That mastery unit was not found.' });
        }
        return res.json({
            success: true,
            courseId: selected.course.id,
            courseName: selected.course.name,
            unitId: selected.section.id,
            unitName: selected.section.name,
            completion: selected.section.completion
        });
    });
    router.get('/:id', async (req, res) => {
        const courseId = req.params.id;
        try {
            const { response, text, data } = await fetchQuizbankCourse(courseId);
            if (!response.ok) return res.status(response.status).send(text || 'Failed to fetch course data');
            console.log(`Full Quizbank course ${courseId}:\n${JSON.stringify(data, null, 2)}`);
            return res.json(data);
        } catch (error) {
            console.error('Course fetch error:', error);
            return res.status(500).json({ error: 'Failed to load course data', details: error.message });
        }
    });

    router.post('/claim', (req, res) => {
        const requiredProgress = Number(req.body.requiredProgress);
        const experience = Number(req.body.experience);
        const milestoneRewards = new Map([[5, 500], [15, 1500], [30, 3000], [50, 5000], [75, 7500], [100, 10000]]);
        const currentSection = state.masteryCourseSets
            .flatMap(courseSet => courseSet.sections)
            .find(section => section.current);
        const expectedExperience = milestoneRewards.get(requiredProgress);
        if (!currentSection || expectedExperience !== experience) {
            return res.status(400).json({ success: false, message: 'Invalid milestone.' });
        }
        if (currentSection.completion < requiredProgress) {
            return res.status(409).json({ success: false, message: 'Milestone is not claimable yet.' });
        }
        if (state.claimedMilestones.has(requiredProgress)) {
            return res.status(409).json({ success: false, message: 'Milestone has already been claimed.' });
        }
        state.claimedMilestones.add(requiredProgress);
        state.addExperience(experience);
        const progression = state.getProgression();
        return res.json({ success: true, xp: progression.XP, maxXp: progression.MAXXP, level: progression.level });
    });
    return router;
}

module.exports = { createCourseRouter };