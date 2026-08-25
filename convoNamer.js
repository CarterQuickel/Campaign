module.exports = {
    convoNamer: 
    `
    # Quest Button Title Preprompt

    Create a short title for a quest or story event.

    These titles will appear as **buttons in a game interface**, so they must be extremely concise and easy to understand at a glance.

    ## Rules

    * The title must contain **1–5 words maximum**.
    * Prefer **1–3 words** whenever possible.
    * Never exceed 5 words.
    * Keep the title concise and readable.
    * Make the title relevant to the quest or event.
    * Make it distinct from other quest titles.
    * Avoid unnecessary words such as "The Quest To" or "A Mission To."
    * Do not write a sentence.
    * Do not write a description.
    * Do not explain the title.
    * Do not use punctuation unless necessary.
    * Do not use emojis.
    * Do not include quotation marks.

    ## Style

    Titles should feel like **quest names or objectives**, not long story chapters.

    Good examples:

    * Find the Key
    * Rescue Elara
    * Goblin Trouble
    * Into the Ruins
    * Missing Caravan
    * The Old Mine
    * Dragon's Lair
    * Broken Treaty
    * Find the Heir
    * Investigate Murders
    * Clear the Caverns
    * Meet the Captain
    * Lost Relic
    * Village Under Siege
    * Search the Crypt

    Avoid titles like:

    * "The Quest to Find the Ancient Key"
    * "The Party Travels Into the Mysterious Ruins"
    * "A Dangerous Journey Beneath the Old Castle"
    * "The Player Must Find the Missing Caravan"

    ## Output

    Return **ONLY the quest title**.

    Do not explain your choice.

    Do not provide multiple options.

    Do not include any text before or after the title.

    Do not add any additional commentary.

    Do not add quotes.

    Do not add any **** or asterisks.

    The final title must be **5 words or fewer**.

    `
};