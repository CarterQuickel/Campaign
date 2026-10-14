module.exports = function(app, state = {}) {
    app.post("/api/game/action", (req, res) => {
        const { action, amount, item, quest } = req.body;
        const parsedAmount = Number(amount ?? 0);
        if (action === "give_item") {
            console.log("AI wants to give item");
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