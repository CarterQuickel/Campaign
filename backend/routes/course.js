const express = require('express');

// Course Progress
function createCourseRouter(state) {
    const router = express.Router();
    router.get('/:id', async (req, res) => {
        const courseId = req.params.id;
        try {
            const upstreamResponse = await fetch(`https://quizbank.yorktechapps.com/api/course/${courseId}`);
            const text = await upstreamResponse.text();
            if (!upstreamResponse.ok) return res.status(upstreamResponse.status).send(text || 'Failed to fetch course data');
            const data = JSON.parse(text);
            if (!Array.isArray(data.units)) return res.status(404).json({ error: 'No units found for this course', courseId });
            console.log(data.units, data.tasks);
            return res.json(data.units);
        } catch (error) {
            console.error('Course fetch error:', error);
            return res.status(500).json({ error: 'Failed to load course data', details: error.message });
        }
    });

    router.post('/claim', (req, res) => {
        const requiredProgress = Number(req.body.requiredProgress);
        const experience = Number(req.body.experience);
        const milestoneRewards = new Map([[5, 500], [15, 800], [30, 1200], [50, 1700], [75, 2300], [100, 3000]]);
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