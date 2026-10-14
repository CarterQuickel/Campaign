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
                    damage: "1d4"
                },
                atk2: {
                    header: "Protection Blast",
                    damage: "2d4"
                },
                atk3: {
                    header: "Skull Imprint",
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
                    damage: "1d10"
                },
                atk2: {
                    header: "Skeletal Stomp",
                    damage: "2d4"
                },
                atk3: {
                    header: "Matador Charge",
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
                    damage: "1d6"
                },
                atk2: {
                    header: "Impenetrable",
                    damage: "1d10"
                },
                atk3: {
                    header: "Self-Destruct",
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
                    damage: "1d8"
                },
                atk2: {
                    header: "Duplication Strike",
                    damage: "4d6"
                },
                atk3: {
                    header: "Rally Cry",
                    damage: "3d4"
                }
            }
        },
        {
            name: "Death Blossom",
            image: "/enemies/enemy_images/story1/Death_Blossom.jpg",
            HP: 41,
            AC: 15,
            attacks: {
                atk1: {
                    header: "Acid Spew",
                    damage: "1d4"
                },
                atk2: {
                    header: "Thorns-o'-Plenty",
                    damage: "1d8"
                },
                atk3: {
                    header: "Fang of Thorns",
                    damage: "2d4"
                },
                atk4: {
                    header: "Great Claws",
                    damage: "1d6+2"
                },
                atk5: {
                    header: "Double Vine Whip",
                    damage: "2d10"
                }
            }
        },
        {
            name: "Gaping Serpent",
            image: "/enemies/enemy_images/story1/Gaping_Serpent.jpg",
            HP: 63,
            AC: 13,
            attacks: {
                atk1: {
                    header: "Head Slam",
                    damage: "2d8"
                },
                atk2: {
                    header: "Venom Projectile",
                    damage: "3d4+3"
                },
                atk3: {
                    header: "Tail Swing",
                    damage: "4d4"
                },
                atk4: {
                    header: "Gaping Jaw",
                    damage: "8d4"
                }
            }
        },
        {
            name: "Red-Maned Wolf",
            image: "/enemies/enemy_images/story1/Red-Maned_Wolf.jpg",
            HP: 39,
            AC: 15,
            attacks: {
                atk1: {
                    header: "Fire Bomb",
                    damage: "2d4"
                },
                atk2: {
                    header: "Lunge",
                    damage: "1d6"
                },
                atk3: {
                    header: "Pheonix Slam",
                    damage: "2d6"
                },
                atk4: {
                    header: "Sacred Seal of the Mountains",
                    damage: "3d6+8"
                }
            }
        },
        {
            name: "Supaida",
            image: "/enemies/enemy_images/story1/Supaida.jpg",
            HP: 28,
            AC: 15,
            attacks: {
                atk1: {
                    header: "Web Shot",
                    damage: "1d8"
                },
                atk2: {
                    header: "Wail Call",
                    damage: "3d4"
                },
                atk3: {
                    header: "Vicious Grab",
                    damage: "5d4"
                },
                atk4: {
                    header: "Death Web",
                    damage: "3d6+3"
                }
            }
        },
        {
            name: "Withstander",
            image: "/enemies/enemy_images/story1/Withstander.jpg",
            HP: 36,
            AC: 15,
            attacks: {
                atk1: {
                    header: "Mallet Toss",
                    damage: "3d6"
                },
                atk2: {
                    header: "Gong Pounder",
                    damage: "2d10"
                },
                atk3: {
                    header: "Gong Smash",
                    damage: "3d6+5"
                }
            }
        },
        {
            name: "The Oracle",
            image: "/enemies/enemy_images/story1/The_Oracle.jpg",
            HP: 101,
            AC: 15,
            attacks: {
                atk1: {
                    header: "See All",
                    damage: "4d8"
                },
                atk2: {
                    header: "Scared Explosion",
                    damage: "10d4"
                },
                atk3: {
                    header: "Golden Beam",
                    damage: "8d6"
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
                    damage: "5d10"
                },
                atk2: {
                    header: "Four-Weighted Fists",
                    damage: "4d12"
                },
                atk3: {
                    header: "Vicious Bite",
                    damage: "4d20"
                },
                atk4: {
                    header: "Hardened Grab",
                    damage: "8d20"
                },
                atk5: {
                    header: "Stomp of End Times",
                    damage: "5d8"
                },
                atk6: {
                    header: "Destruction of the Forthcoming",
                    damage: "10d20"
                },
                atk7: {
                    header: "Rock Solid",
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
                    damage: "10d3"
                }
            }
        }
    ]
}