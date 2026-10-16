module.exports = function(app, state = {}) {
    app.post("/api/game/action", (req, res) => {
        const { action, amount, item, quest } = req.body;
        const parsedAmount = Number(amount ?? 0);
        if (action === "give_item" || action === "unlock_item") {
            const requestedName = String(item || '').trim().toLowerCase();
            const inventoryItem = Array.isArray(state.tools)
                ? state.tools.find(tool => tool.name?.trim().toLowerCase() === requestedName)
                : null;
            if (!inventoryItem) {
                return res.status(404).json({ success: false, message: 'That item is not in the available item list.' });
            }
            inventoryItem.unlocked = true;
            return res.json({ success: true, action: 'unlock_item', item: inventoryItem.name });
        }
        if (action === "update_quest") {
            console.log("AI wants to update quest");
        }
        res.json({
            success: true,
            action,
            amount: parsedAmount
        });
    });
};