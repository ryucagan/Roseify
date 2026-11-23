// Small bundled dataset used in demo mode or when Data Dragon / valorant-api.com
// can't be reached. Real mode replaces this with full live data.

const QUEUE_NAMES = {
  0: 'Custom', 400: 'Normal Draft', 420: 'Ranked Solo/Duo', 430: 'Normal Blind', 440: 'Ranked Flex',
  450: 'ARAM', 480: 'Swiftplay', 490: 'Quickplay', 700: 'Clash', 720: 'ARAM Clash',
  830: 'Co-op vs AI', 840: 'Co-op vs AI', 850: 'Co-op vs AI', 870: 'Co-op vs AI', 880: 'Co-op vs AI', 890: 'Co-op vs AI',
  900: 'ARURF', 1020: 'One for All', 1300: 'Nexus Blitz', 1400: 'Ultimate Spellbook',
  1700: 'Arena', 1710: 'Arena', 1750: 'Arena', 1900: 'URF', 2300: 'Brawl', 2400: 'ARAM: Mayhem',
};

// [ddragonId, numericKey, name, class]
const CHAMPS = [
  ['Ahri', 103, 'Ahri', 'mage'], ['Yasuo', 157, 'Yasuo', 'fighter'], ['LeeSin', 64, 'Lee Sin', 'fighter'],
  ['Jinx', 222, 'Jinx', 'marksman'], ['Thresh', 412, 'Thresh', 'support'], ['Darius', 122, 'Darius', 'fighter'],
  ['Garen', 86, 'Garen', 'fighter'], ['Lux', 99, 'Lux', 'mage'], ['Ezreal', 81, 'Ezreal', 'marksman'],
  ['Kaisa', 145, "Kai'Sa", 'marksman'], ['Yone', 777, 'Yone', 'fighter'], ['Sett', 875, 'Sett', 'fighter'],
  ['Viego', 234, 'Viego', 'fighter'], ['Lulu', 117, 'Lulu', 'support'], ['Leona', 89, 'Leona', 'tank'],
  ['Zed', 238, 'Zed', 'assassin'], ['Akali', 84, 'Akali', 'assassin'], ['Vayne', 67, 'Vayne', 'marksman'],
  ['MissFortune', 21, 'Miss Fortune', 'marksman'], ['Ashe', 22, 'Ashe', 'marksman'], ['Jhin', 202, 'Jhin', 'marksman'],
  ['Malphite', 54, 'Malphite', 'tank'], ['Ornn', 516, 'Ornn', 'tank'], ['Graves', 104, 'Graves', 'marksman'],
  ['Kayn', 141, 'Kayn', 'assassin'], ['Sylas', 517, 'Sylas', 'mage'], ['Nami', 267, 'Nami', 'support'],
  ['Caitlyn', 51, 'Caitlyn', 'marksman'], ['Katarina', 55, 'Katarina', 'assassin'], ['Morgana', 25, 'Morgana', 'support'],
];

const ITEMS = {
  1001: 'Boots', 1054: "Doran's Shield", 1055: "Doran's Blade", 1056: "Doran's Ring", 2003: 'Health Potion',
  3340: 'Stealth Ward', 3364: 'Oracle Lens', 3363: 'Farsight Alteration', 3850: 'World Atlas',
  1101: 'Scorchclaw Pup', 1102: 'Gustwalker Hatchling', 1103: 'Mosstomper Seedling',
  3006: "Berserker's Greaves", 3020: "Sorcerer's Shoes", 3047: 'Plated Steelcaps', 3111: "Mercury's Treads", 3158: 'Ionian Boots of Lucidity',
  3031: 'Infinity Edge', 6672: 'Kraken Slayer', 3094: 'Rapid Firecannon', 3036: "Lord Dominik's Regards", 3072: 'Bloodthirster',
  3153: 'Blade of The Ruined King', 3046: 'Phantom Dancer', 6655: "Luden's Companion", 3089: "Rabadon's Deathcap", 3135: 'Void Staff',
  3157: "Zhonya's Hourglass", 4645: 'Shadowflame', 3165: 'Morellonomicon', 3078: 'Trinity Force', 6333: "Death's Dance",
  3071: 'Black Cleaver', 3053: "Sterak's Gage", 6692: 'Eclipse', 3142: "Youmuu's Ghostblade", 3068: 'Sunfire Aegis',
  3075: 'Thornmail', 3065: 'Spirit Visage', 3190: 'Locket of the Iron Solari', 3109: "Knight's Vow", 3504: 'Ardent Censer',
  6617: 'Moonstone Renewer', 3814: 'Edge of Night', 3026: 'Guardian Angel', 3156: 'Maw of Malmortius', 3143: "Randuin's Omen",
};

const ITEM_SETS = {
  marksman: { start: [1055, 2003], boots: [3006, 3047], core: [6672, 3031, 3094, 3036, 3072, 3046, 3026] },
  mage: { start: [1056, 2003], boots: [3020, 3158], core: [6655, 3089, 3135, 3157, 4645, 3165] },
  fighter: { start: [1055, 2003], boots: [3047, 3111], core: [3078, 3071, 6333, 3053, 3026, 3156, 3065] },
  assassin: { start: [1055, 2003], boots: [3158, 3047], core: [6692, 3142, 3814, 6333, 3036, 3156] },
  tank: { start: [1054, 2003], boots: [3047, 3111], core: [3068, 3075, 3065, 3143, 3190, 3109] },
  support: { start: [3850, 2003], boots: [3158, 3047], core: [6617, 3504, 3190, 3109, 3065, 3157] },
};

const SPELLS = {
  1: ['SummonerBoost', 'Cleanse'], 3: ['SummonerExhaust', 'Exhaust'], 4: ['SummonerFlash', 'Flash'], 6: ['SummonerHaste', 'Ghost'],
  7: ['SummonerHeal', 'Heal'], 11: ['SummonerSmite', 'Smite'], 12: ['SummonerTeleport', 'Teleport'], 14: ['SummonerDot', 'Ignite'],
  21: ['SummonerBarrier', 'Barrier'], 32: ['SummonerSnowball', 'Mark'],
};

const RUNE_STYLES = { 8000: 'Precision', 8100: 'Domination', 8200: 'Sorcery', 8300: 'Inspiration', 8400: 'Resolve' };
const RUNES = {
  8005: 'Press the Attack', 8008: 'Lethal Tempo', 8021: 'Fleet Footwork', 8010: 'Conqueror', 8112: 'Electrocute',
  8128: 'Dark Harvest', 9923: 'Hail of Blades', 8214: 'Summon Aery', 8229: 'Arcane Comet', 8230: 'Phase Rush',
  8437: 'Grasp of the Undying', 8439: 'Aftershock', 8465: 'Guardian', 8351: 'Glacial Augment', 8369: 'First Strike',
  9111: 'Triumph', 9104: 'Legend: Alacrity', 9105: 'Legend: Haste', 8014: 'Coup de Grace', 8299: 'Last Stand', 8017: 'Cut Down',
  8126: 'Cheap Shot', 8139: 'Taste of Blood', 8143: 'Sudden Impact', 8140: 'Grisly Mementos', 8135: 'Treasure Hunter', 8106: 'Ultimate Hunter',
  8226: 'Manaflow Band', 8275: 'Nimbus Cloak', 8210: 'Transcendence', 8234: 'Celerity', 8237: 'Scorch', 8233: 'Absolute Focus', 8236: 'Gathering Storm',
  8446: 'Demolish', 8463: 'Font of Life', 8401: 'Shield Bash', 8429: 'Conditioning', 8444: 'Second Wind', 8473: 'Bone Plating', 8451: 'Overgrowth', 8453: 'Revitalize',
  8304: 'Magical Footwear', 8321: 'Cash Back', 8345: 'Biscuit Delivery', 8347: 'Cosmic Insight', 8410: 'Approach Velocity', 8352: 'Time Warp Tonic',
  5008: 'Adaptive Force', 5005: 'Attack Speed', 5007: 'Ability Haste', 5001: 'Health Scaling', 5011: 'Health', 5013: 'Tenacity and Slow Resist', 5010: 'Move Speed',
};
const RUNE_PAGES = {
  marksman: [8000, [8008, 9111, 9104, 8014], 8100, [8139, 8135], [5005, 5008, 5011]],
  mage: [8100, [8112, 8126, 8140, 8135], 8200, [8226, 8237], [5008, 5008, 5011]],
  fighter: [8000, [8010, 9111, 9105, 8299], 8400, [8444, 8451], [5005, 5008, 5011]],
  assassin: [8100, [8112, 8143, 8140, 8106], 8000, [9111, 8014], [5008, 5008, 5011]],
  tank: [8400, [8439, 8401, 8444, 8451], 8300, [8304, 8347], [5007, 5011, 5013]],
  support: [8200, [8214, 8226, 8210, 8237], 8400, [8463, 8453], [5007, 5008, 5011]],
};
const AUGMENTS = {
  1: 'Back to Basics', 2: 'Blade Waltz', 3: 'Celestial Body', 4: 'Dashing', 5: 'Goliath', 6: 'Jeweled Gauntlet',
  7: 'Mystic Punch', 8: 'Omni Soul', 9: 'Quest: Steel Your Heart', 10: 'Tank Engine', 11: 'Vulnerability', 12: 'Witchful Thinking',
};

const ROLE_FOR_CLASS = { marksman: 'BOTTOM', mage: 'MIDDLE', fighter: 'TOP', assassin: 'MIDDLE', tank: 'TOP', support: 'UTILITY' };

// Valorant
const VAL_AGENTS = [
  ['add6443a-41bd-e414-f6ad-e58d267f4e95', 'Jett', 'Duelist'], ['a3bfb853-43b2-7238-a4f1-ad90e9e46bcc', 'Reyna', 'Duelist'],
  ['eb93336a-449b-9c1b-0a54-a891f7921d69', 'Phoenix', 'Duelist'], ['f94c3b30-42be-e959-889c-5aa313dba261', 'Raze', 'Duelist'],
  ['7f94d92c-4234-0a36-9646-3a87eb8b5c89', 'Yoru', 'Duelist'], ['bb2a4828-46eb-8cd1-e765-15848195d751', 'Neon', 'Duelist'],
  ['0e38b510-41a8-5780-5e8f-568b2a4f2d6c', 'Iso', 'Duelist'], ['df1cb487-4902-002e-5c17-d28e83e78588', 'Waylay', 'Duelist'],
  ['320b2a48-4d9b-a075-30f1-1f93a9b638fa', 'Sova', 'Initiator'], ['5f8d3a7f-467b-97f3-062c-13acf203c006', 'Breach', 'Initiator'],
  ['6f2a04ca-43e0-be17-7f36-b3908627744d', 'Skye', 'Initiator'], ['601dbbe7-43ce-be57-2a40-4abd24953621', 'KAY/O', 'Initiator'],
  ['dade69b4-4f5a-8528-247b-219e5a1facd6', 'Fade', 'Initiator'], ['e370fa57-4757-3604-3648-499e1f642d3f', 'Gekko', 'Initiator'],
  ['b444168c-4e35-8076-db47-ef9bf368f384', 'Tejo', 'Initiator'],
  ['8e253930-4c05-31dd-1b6c-968525494517', 'Omen', 'Controller'], ['9f0d8ba9-4140-b941-57d3-a7ad57c6b417', 'Brimstone', 'Controller'],
  ['707eab51-4836-f488-046a-cda6bf494859', 'Viper', 'Controller'], ['41fb69c1-4189-7b37-f117-bcaf1e96f1bf', 'Astra', 'Controller'],
  ['95b78ed7-4637-86d9-7e41-71ba8c293152', 'Harbor', 'Controller'], ['1dbf2edd-4729-0984-3115-daa5eed44993', 'Clove', 'Controller'],
  ['569fdd95-4d10-43ab-ca70-79becc718b46', 'Sage', 'Sentinel'], ['117ed9e3-49f3-6512-3ccf-0cada7e3823b', 'Cypher', 'Sentinel'],
  ['1e58de9c-4950-5125-93e9-a0aee9f98746', 'Killjoy', 'Sentinel'], ['22697a3d-45bf-8dd7-4fec-84a9e28c69d7', 'Chamber', 'Sentinel'],
  ['cc8b64c8-4b25-4ff9-6e7f-37b4da43d235', 'Deadlock', 'Sentinel'], ['efba5359-4016-a1e5-7626-b1ae76895940', 'Vyse', 'Sentinel'],
];
const VAL_MAPS = [
  ['/Game/Maps/Ascent/Ascent', 'Ascent'], ['/Game/Maps/Duality/Duality', 'Bind'], ['/Game/Maps/Triad/Triad', 'Haven'],
  ['/Game/Maps/Bonsai/Bonsai', 'Split'], ['/Game/Maps/Port/Port', 'Icebox'], ['/Game/Maps/Foxtrot/Foxtrot', 'Breeze'],
  ['/Game/Maps/Canyon/Canyon', 'Fracture'], ['/Game/Maps/Pitt/Pitt', 'Pearl'], ['/Game/Maps/Jam/Jam', 'Lotus'],
  ['/Game/Maps/Juliett/Juliett', 'Sunset'], ['/Game/Maps/Infinity/Infinity', 'Abyss'], ['/Game/Maps/Rook/Rook', 'Corrode'],
];
const VAL_TIER_NAMES = ['Unranked', 'Unused1', 'Unused2', 'Iron 1', 'Iron 2', 'Iron 3', 'Bronze 1', 'Bronze 2', 'Bronze 3',
  'Silver 1', 'Silver 2', 'Silver 3', 'Gold 1', 'Gold 2', 'Gold 3', 'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3', 'Ascendant 1', 'Ascendant 2', 'Ascendant 3', 'Immortal 1', 'Immortal 2', 'Immortal 3', 'Radiant'];
const VAL_TIER_SET = '03621f52-342b-cf4e-4f86-9350a49c6d04';
const VAL_QUEUES = {
  competitive: 'Competitive', unrated: 'Unrated', swiftplay: 'Swiftplay', spikerush: 'Spike Rush', deathmatch: 'Deathmatch',
  premier: 'Premier', ggteam: 'Escalation', onefa: 'Replication', hurm: 'Team Deathmatch', newmap: 'New Map', snowball: 'Snowball Fight', '': 'Custom',
};

module.exports = {
  QUEUE_NAMES, CHAMPS, ITEMS, ITEM_SETS, SPELLS, RUNE_STYLES, RUNES, RUNE_PAGES, AUGMENTS, ROLE_FOR_CLASS,
  VAL_AGENTS, VAL_MAPS, VAL_TIER_NAMES, VAL_TIER_SET, VAL_QUEUES,
};
