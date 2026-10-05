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
        },
        {
            name: "Fallen King",
            image: "/enemies/enemy_images/story1/Fallen_King.jpg",
            HP: 27,
            AC: 13,
            attacks: {
                atk1: {
                    header: "Great Slash",
                    desc: "The King's Ruin slashes down upon you.",
                    damage: "1d8"
                },
                atk2: {
                    header: "Duplication Strike",
                    desc: "The King splits into many souls, which all slash you at once.",
                    damage: "4d6"
                },
                atk3: {
                    header: "Rally Cry",
                    desc: "A burden is evoked upon you, weighing down your soul.",
                    damage: "3d4"
                }
            }
        },
        {
            name: "Alternate X",
            image: "/enemies/enemy_images/story1/Alternate_X.jpg",
            HP: 376,
            AC: 15,
            attacks: {
                atk1: {
                    header: "Brute Charge",
                    desc: "Full of fury, Alternate X charges towards you, fire trailing behind him.",
                    damage: "5d10"
                },
                atk2: {
                    header: "Four-Weighted Fists",
                    desc: "Alternate X grows 2 extra arms, which all strike at once.",
                    damage: "4d12"
                },
                atk3: {
                    header: "Vicious Bite",
                    desc: "Alternate X snaps at you, his hardened jaw crushing down upon your body.",
                    damage: "4d20"
                },
                atk4: {
                    header: "Hardened Grab",
                    desc: "Fist of stone, Alternate X grabs you and crushes you with a simple squeeze.",
                    damage: "8d20"
                },
                atk5: {
                    header: "Stomp of End Times",
                    desc: "Jumping into the air, Alternate X slams down upon the earth.",
                    damage: "5d8"
                },
                atk6: {
                    header: "Destruction of the Forthcoming",
                    desc: "Alternate X brings a fury of strikes and explosions upon you.",
                    damage: "10d20"
                },
                atk7: {
                    header: "Rock Solid",
                    desc: "Alternate X turns to stone, which freezes the world in time. Any who dare attack him are heavily hindered.",
                    damage: "20d20+45"
                }
            }
        },
        {
            name: "The Forthcoming",
            image: "/enemies/enemy_images/story1/Forthcoming.jpg",
            HP: 908,
            AC: 17,
            attacks: {
                atk1: {
                    header: "Pulse of the Inevitable End",
                    desc: "The world shakes and crumbles as your brain begins to collapse in on itself.",
                    damage: "10d3"
                }
            }
        }
    ]
}