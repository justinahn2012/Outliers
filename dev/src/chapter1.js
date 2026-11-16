// Chapter 1 — UNCOUNTED. Harrow Street -> Pier 9 Market -> Gut Lane -> Pier 9, then below Pier 9.
// Speakers: null (Iris), rem (the voice in her chip), radio (Census radio), auditor, moth.

export const CHAPTER = {
  num: 1, title: 'UNCOUNTED', place: 'HARROW STREET · CANTOR SOUND · 2061',
  zones: [
    { // HARROW STREET
      spawns: [[-4, -23.5], [4, -23.5], [0, -21], [-11.6, -16.5], [11.6, -12], [-11.6, -2.5], [11.6, 2], [-11.6, 12], [11.6, 15]],
      enter: [['null', 'Rain. Rain is safe.'], ['rem', "Morning, Iris. Your count is still zero. Let's keep it that way."]],
      waves: [
        { sub: 'THE CENSUS IS COUNTING', list: ['counter', 'counter', 'counter'], say: [['radio', 'All units, Harrow Street. Heat signature, no Tally. Find it and count it.']] },
        { sub: 'MARKSMEN — HOLD SOMETHING UP TO BLOCK', list: ['counter', 'marksman', 'counter', 'marksman'], say: [['rem', 'Rifles. Put something between you and them. Something with paperwork.']] },
      ],
      clear: [['radio', "Harrow sweep came back... minus one. That's not a number."], ['null', 'It is now.'], ['rem', "They've locked the market. The checkpoint just lost its signal."]],
      next: 'THROUGH THE MARKET',
    },
    { // PIER 9 MARKET
      spawns: [[-4, -62.5], [0, -62.5], [4, -62.5], [-6.3, -48.1], [6.3, -37.2], [-6.3, -40], [6.3, -58]],
      enter: [['rem', "Ninety-nine point nine nine nine seven percent. They're close, Iris."]],
      waves: [
        { sub: 'NIGHT MARKET', list: ['marksman', 'counter', 'counter', 'marksman', 'counter'], say: [['radio', 'Vendors, stay where you are. Remain countable.']] },
        { sub: 'LOBBERS — CATCH THE GRENADES', list: ['lobber', 'counter', 'marksman', 'counter'], say: [['rem', 'Grenades are countdowns. Countdowns are just counts. Catch one.']] },
      ],
      clear: [['null', 'Everybody counted? Good.'], ['rem', "Gut Lane runs down to the pier. Moth's is at the end of it."]],
      next: 'DOWN GUT LANE',
    },
    { // GUT LANE
      spawns: [[-2.5, -90.5], [2.5, -90.5], [0, -89], [-3.4, -82], [3.4, -78]],
      enter: [['null', 'Someone painted my mark. My zero.'], ['rem', 'You did. Tuesday. You forgot.']],
      waves: [
        { sub: 'GUT LANE', list: ['lobber', 'counter', 'lobber', 'counter', 'marksman'], say: [['radio', 'Contact in Gut Lane. Pin it down. Grenades authorized.']] },
      ],
      clear: [['radio', 'All units, fall back to Pier 9. The Auditor is on scene.'], ['rem', "The Auditor. Big. Patient. Never miscounts. Use heavy things."]],
      next: 'TO PIER 9',
    },
    { // PIER 9
      spawns: [[-10, -127], [0, -128], [8, -119], [-17, -112], [-6, -121], [4, -114], [-12, -104]],
      enter: [['null', 'Lights. Under the water.'], ['rem', "Don't look too long."]],
      waves: [
        { sub: 'THE AUDITOR', list: ['auditor', 'counter', 'lobber', 'counter'], boss: true, reinforce: ['counter', 'marksman', 'counter', 'marksman'],
          say: [['radio', 'Auditor, you have the count.'], ['rem', 'He charges. Put a car in his way. Or a container.']] },
      ],
      clear: [['null', '...He said one.'], ['rem', "You're running hot. Moth's door is right there."]],
      next: 'GO BELOW PIER 9',
    },
  ],
  reinforce: [['radio', 'Reinforcements to the pier. Keep her counted.']],
  auditorDown: [['auditor', '...One.']],
  ending: [
    ['moth', "You're late. Arm."],
    ['null', 'How many?'],
    ['moth', 'Forty-two marks. One more than this morning.'],
    ['null', 'What did I lose?'],
    ['moth', "If I knew, it wouldn't be lost."],
    ['rem', "Don't worry, Iris. I've got it."],
  ],
};
