module.exports = function(app, state = {}) {
    app.post("/api/game/action", (req, res) => {
        const { action, amount, gold_amount, item, quest } = req.body;
        const parsedAmount = Number(amount ?? gold_amount ?? 0);
        if (action === "give_gold") {
            state.gold = (Number(state.gold) || 0) + parsedAmount;
            console.log("AI wants to give gold:", parsedAmount, "Current gold:", state.gold);
        }
        if (action === "give_item") {
            console.log("AI wants to give item");
        }
        if (action === "update_quest") {
            console.log("AI wants to update quest");
        }
        res.json({
            success: true,
            action,
            amount: parsedAmount,
            gold: Number(state.gold) || 0
        });
    });
};