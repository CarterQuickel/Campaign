module.exports = function(app) {
    app.post("/api/game/action", (req, res) => {
        const { action, amount, item, quest } = req.body;
        if (action === "give_gold") {
            console.log("AI wants to give gold");
        }
        if (action === "give_item") {
            console.log("AI wants to give item");
        }
        if (action === "update_quest") {
            console.log("AI wants to update quest");
        }
        res.json({
            success: true,
            amount: amount
        });
    });
};