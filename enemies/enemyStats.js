module.exports = {
    enemies: [
        {
            name: "Death Possessor",
            image: "/enemies/enemy_images/Death_Possessor.jpg",
            HP: 19,
            AC: 16,
            attacks: {
                atk1: {
                    header: "Necromancer Swirl",
                    desc: "Death Possessor spins around the staff, a beam of light illuminating its tip as energy consumes you.",
                    damage: "1d4"
                },
                atk2: {
                    header: "Protection Blast",
                    desc: "Death Possessor slams his staff into the ground, exploding a bubble that creates an AOE.",
                    damage: "2d4"
                },
                atk3: {
                    header: "Skull Imprint",
                    desc: "Death Possessor casts a mark upon your body, making you feel burdened.",
                    damage: "1d8"
                }
            }
        },
        {
            name: "Bull Rider",
            image: "/enemies/enemy_images/Bull_Rider.jpg",
            HP: 22,
            AC: 14,
            attacks: {
                atk1: {
                    header: "Bull Ram",
                    desc: "Bull Rider swings its vicious horns at you.",
                    damage: "1d10"
                },
                atk2: {
                    header: "Skeletal Stomp",
                    desc: "The bones within the bull build up energy, which creates a large shockwave upon the earth.",
                    damage: "2d4"
                },
                atk3: {
                    header: "Matador Charge",
                    desc: "A magic red banner appears over the bull's eyes, making him go mad as he charges fowards.",
                    damage: "3d6"
                }
            }
        },
        {
            name: "Fire Goblin",
            image: "/enemies/enemy_images/Fire_Goblin.jpg",
            HP: 8,
            AC: 12,
            attacks: {
                atk1: {
                    header: "Fire Scorch",
                    desc: "Fire Goblin summons a homing projectile engulfed in magic flames.",
                    damage: "1d6"
                },
                atk2: {
                    header: "Impenetrable",
                    desc: "Fire Goblin casts fire upon your body, which cannot be put out.",
                    damage: "1d10"
                },
                atk3: {
                    header: "Self-Destruct",
                    desc: "Fire Goblin uses a detonation spell to create an explosion around him, which doesn't harm him.",
                    damage: "3d4"
                }
            }
        }
    ]
}