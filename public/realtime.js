(function connectRealtime() {
    if (typeof io !== 'function') return;

    const socket = io();

    function updateStats(data) {
        if (!data) return;
        const level = Number(data.level);
        const xp = Number(data.xp);
        const maxXp = Number(data.maxXp);
        const maxHp = Number(data.hp);
        const currentHp = Number(data.currentHp ?? maxHp);

        document.querySelectorAll('[data-realtime-level]').forEach(element => {
            if (Number.isFinite(level)) {
                element.textContent = element.dataset.realtimeLevelLabel === 'true'
                    ? `Level ${level}`
                    : String(level);
            }
        });
        document.querySelectorAll('[data-realtime-xp]').forEach(element => {
            if (Number.isFinite(xp) && Number.isFinite(maxXp)) element.textContent = `${xp}/${maxXp} XP`;
        });
        document.querySelectorAll('[data-realtime-hp]').forEach(element => {
            if (Number.isFinite(currentHp) && Number.isFinite(maxHp)) element.textContent = `${currentHp}/${maxHp}`;
        });

        const xpProgress = document.getElementById('xpprogress');
        if (xpProgress && Number.isFinite(xp) && Number.isFinite(maxXp)) {
            xpProgress.value = xp;
            xpProgress.max = maxXp;
        }

        const accountSummary = document.querySelector('.accountSummaryGrid');
        if (accountSummary && typeof refreshAccountPanel === 'function') refreshAccountPanel();
    }

    function renderAttackItems(tools) {
        const attackItems = document.getElementById('attackItems');
        if (!attackItems) return;
        const weapons = tools.filter(item => item.unlocked && item.class !== 'Armor' && item.damage && item.damage !== '0');
        attackItems.replaceChildren(...weapons.map(item => {
            const category = String(item.class || 'Misc').toLowerCase();
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `tool selectable ${category}`;
            button.dataset.name = item.name;
            button.dataset.class = item.class || 'Misc';
            button.dataset.unlocked = 'true';
            button.dataset.damage = item.damage;

            const left = document.createElement('div');
            left.className = 'left-tool';
            const icon = document.createElement('div');
            icon.className = `tool-icon ${category}`;
            icon.textContent = item.class === 'Weapon' ? '⚔️'
                : item.class === 'Potion' ? '🧪'
                    : item.class === 'Spell' ? '🔮' : '💎';
            const content = document.createElement('div');
            content.className = 'tool-cont';
            const name = document.createElement('div');
            name.className = 'tool-name';
            name.textContent = item.name;
            const damage = document.createElement('div');
            damage.className = 'tool-damage';
            damage.textContent = `${item.damage} dg`;
            content.append(name, damage);
            left.append(icon, content);
            button.append(left);
            return button;
        }));
    }

    function updateInventory(tools) {
        if (!Array.isArray(tools)) return;
        renderAttackItems(tools);
        const inventory = document.querySelector('.toolsContainer');
        if (!inventory) return;
        tools.forEach(item => {
            let card = [...inventory.querySelectorAll('.tool')]
                .find(candidate => candidate.dataset.name === item.name);
            if (!card) {
                card = document.createElement('div');
                card.className = `tool ${String(item.class || 'Misc').toLowerCase()}`;
                card.dataset.name = item.name;
                card.dataset.class = item.class || 'Misc';
                card.dataset.weight = item.weight ?? 0;
                card.innerHTML = `
                    <div class="left-tool">
                        <div class="tool-icon ${String(item.class || 'Misc').toLowerCase()}">${item.class === 'Weapon' ? '⚔️' : item.class === 'Armor' ? '🛡️' : item.class === 'Potion' ? '🧪' : item.class === 'Spell' ? '🔮' : '💎'}</div>
                        <div class="tool-cont">
                            <div class="tool-name"></div>
                            <div class="tool-description"></div>
                            <div class="tool-damage"></div>
                        </div>
                    </div>`;
                card.querySelector('.tool-name').textContent = item.name;
                inventory.appendChild(card);
            }
            card.dataset.unlocked = String(item.unlocked);
            card.classList.toggle('locked', !item.unlocked);
            const description = card.querySelector('.tool-description');
            if (description) description.textContent = item.desc || '';
            const damage = card.querySelector('.tool-damage');
            if (damage) {
                damage.textContent = item.damage && item.damage !== '0' ? `${item.damage} dg` : '';
                damage.style.display = item.damage && item.damage !== '0' ? 'flex' : 'none';
            }
        });
        if (typeof filterTools === 'function') {
            filterTools('all');
        }
    }

    function updateCombat(combat) {
        if (!combat) return;
        const enemyHpBar = document.getElementById('enemyHPBar');
        const enemyHpText = document.getElementById('enemyHPText');
        if (enemyHpBar && Number.isFinite(Number(combat.enemyHP))) {
            enemyHpBar.value = Number(combat.enemyHP);
            if (enemyHpText) enemyHpText.textContent = `${combat.enemyHP}/${enemyHpBar.max} HP`;
        }
        const playerHpBar = document.getElementById('playerHPBar');
        const playerHp = document.getElementById('playerHPDisplay');
        if (Number.isFinite(Number(combat.playerHP))) {
            if (playerHpBar) {
                if (Number.isFinite(Number(combat.playerMaxHP))) playerHpBar.max = Number(combat.playerMaxHP);
                playerHpBar.value = Number(combat.playerHP);
            }
            if (playerHp) {
                const maxHp = Number.isFinite(Number(combat.playerMaxHP))
                    ? Number(combat.playerMaxHP)
                    : playerHpBar?.max || playerHp.textContent.trim().split('/')[1] || '';
                playerHp.textContent = `${combat.playerHP}/${maxHp} HP`;
            }
        }
    }

    function updateMastery(mastery) {
        if (!Array.isArray(mastery)) return;
        mastery.forEach(course => {
            const sections = Array.isArray(course.sections) ? course.sections : [];
            sections.forEach(section => {
                const selector = `[data-course-id="${course.id}"][data-unit-id="${section.id}"]`;
                document.querySelectorAll(`.mastery-unit${selector}`).forEach(unit => {
                    unit.dataset.completion = section.completion;
                    const percent = unit.querySelector('.secPercent');
                    if (percent) percent.textContent = `${section.completion}%`;
                    const button = unit.querySelector('.setMasteryBtn');
                    if (button) {
                        button.disabled = Boolean(section.current);
                        button.textContent = section.current ? 'Current' : 'Make current';
                    }
                    const mark = unit.querySelector('.mastery-current-mark');
                    if (mark) mark.textContent = section.current ? '(CURRENT)' : '';
                });
                document.querySelectorAll(`.slice${selector}`).forEach(slice => {
                    slice.style.setProperty('--radius', `${section.completion}%`);
                });
            });
        });
    }

    socket.on('account:update', data => {
        updateStats(data);
        updateInventory(data?.tools);
        updateCombat(data?.combat);
        updateMastery(data?.mastery);
    });
    socket.on('inventory:update', data => updateInventory(data?.tools));
})();
