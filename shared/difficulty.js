// The three difficulty levels, picked on the title screen. Everything that
// scales lives here so it can be tuned in one place.
export const DIFFICULTY = {
  easy: {
    id: 'easy', label: 'AASAAN', icon: '🙂',
    blurb: 'Warden Saab thode dheele hain. 7 chances. Sirf haath ka saaman jaata hai.',
    warden: { rate: 0.7, speed: 0.85, range: 0.85 },
    chances: 7,
    confiscate: 'held',
    roomCheck: { first: 110, calm: 130, hunting: 95 },
    clockMinutes: 15,                     // real minutes to order before 3 AM
    brawl: { count: 6, hp: 2, damage: 8, speed: 1.9 },
    scoreMult: 0.75,
  },
  normal: {
    id: 'normal', label: 'THEEK-THAAK', icon: '😐',
    blurb: 'Jaisa hostel hota hai. 5 chances. Pakde gaye toh saara saaman.',
    warden: { rate: 1, speed: 1, range: 1 },
    chances: 5,
    confiscate: 'all',
    roomCheck: { first: 70, calm: 85, hunting: 60 },
    clockMinutes: 12,
    brawl: { count: 8, hp: 2, damage: 12, speed: 2.2 },
    scoreMult: 1,
  },
  hard: {
    id: 'hard', label: 'WARDEN MODE', icon: '😈',
    blurb: 'Teez nazar, tez chaal. 3 chances. Jhagda bhi bada.',
    warden: { rate: 1.25, speed: 1.15, range: 1.15 },
    chances: 3,
    confiscate: 'all',
    roomCheck: { first: 50, calm: 60, hunting: 40 },
    clockMinutes: 10,
    brawl: { count: 10, hp: 3, damage: 16, speed: 2.5 },
    scoreMult: 1.5,
  },
};

export const getDifficulty = (id) => DIFFICULTY[id] || DIFFICULTY.normal;
