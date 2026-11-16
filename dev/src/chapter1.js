// Chapter 1 — UNCOUNTED. Ten areas, ~45-60 minutes.
// Speakers: null, rem (the voice in her chip), radio (Census radio), rook (Inspector Rook's private channel),
// weil (Registrar's broadcast), moth, auditor, memory (recovered fragments).
// Step kinds: wave | relays | rescue | lockdown | lamplighter | chase | auditor1 | auditor2

export const CHAPTER = {
  num: 1, title: 'UNCOUNTED', place: 'HARROW STREET · CANTOR SOUND · 2061',
  zones: [
    { // 0 HARROW STREET
      spawns: [[-4, -23.5], [4, -23.5], [0, -21], [-11.6, -16.5], [11.6, -18], [-11.6, -2.5], [11.6, 2], [-11.6, 12], [11.6, 15]],
      enter: [['null', 'Rain. Rain is safe.'], ['rem', "Morning, Iris. Your count is still zero. Let's keep it that way."]],
      steps: [
        { kind: 'wave', sub: 'THE CENSUS IS COUNTING', list: ['counter', 'counter', 'counter'], say: [['radio', 'All units, Harrow Street. Heat signature, no Tally. Find it and count it.']] },
        { kind: 'wave', sub: 'MARKSMEN — HOLD SOMETHING UP TO BLOCK', list: ['counter', 'marksman', 'counter', 'marksman'], say: [['rem', 'Rifles. Put something between you and them. Something with paperwork.']] },
        { kind: 'wave', sub: 'THEY BROUGHT FRIENDS', list: ['counter', 'counter', 'marksman', 'counter', 'counter'], say: [['rem', "Swing what you're holding through them. That counts too."]] },
      ],
      clear: [['radio', "Harrow sweep came back... minus one. That's not a number."], ['null', 'It is now.'], ['rem', 'The checkpoint plaza is east. The Census watches this whole block from there.']],
      next: 'EAST TO THE CHECKPOINT',
      frags: [[-11.6, 23.4, 'An insurance file. Claim 4471, water damage, Tidelines, 2052. Status: DENIED. Property does not exist.'], [11.2, -26.2, "Mom's piano. The C sharp sticks. She'd hit it twice and laugh."]],
    },
    { // 1 CHECKPOINT PLAZA
      spawns: [[60, -28], [60, 2], [46, -28.5], [60, -12], [46, 2.5], [32, -28.5], [32, 2.5]],
      enter: [['weil', 'Good evening, Cantor Sound. We are ninety-nine point nine nine nine seven percent of the way home.'], ['weil', "If you see someone who isn't counted, help them. Report them."], ['rem', 'Three relays feed this block. Break them and the Census goes blind here.']],
      steps: [
        { kind: 'relays', sub: 'SMASH THE TALLY RELAYS', list: ['warden', 'counter', 'counter'], trickle: ['counter', 'marksman', 'warden', 'counter'], every: 14,
          say: [['rem', 'Relays only feel heavy things. Throw something with a VIN number.'], ['rem', 'That one has a shield. Shields only face one way. Hit him from behind, or Surge it off him.']] },
        { kind: 'wave', sub: 'WARDENS', list: ['warden', 'warden', 'marksman', 'counter'], say: [['radio', 'Relays down on the plaza. Wardens, hold the line.']] },
      ],
      clear: [['rook', "This is Inspector Rook. Whoever you are, you just blinded a whole block. I'd like to talk."], ['null', 'Count yourself lucky.'], ['rem', 'The old tram cut runs to the market.']],
      next: 'TAKE THE TRAM CUT',
      frags: [[61.2, 3.2, "The Halden consent form. Your signature. Someone else's handwriting on the line that says WHY."], [30.8, -29.2, 'A tram ticket to Pier 9, punched forty-one times.']],
    },
    { // 2 TRAM CUT
      spawns: [[9, -45], [12, -43], [20, -47], [26, -43], [41, -43], [47, -46], [47, -40]],
      enter: [['rem', "Clerks. Little drones. They stamp things so you can't lift them. They're also very easy to throw."]],
      steps: [
        { kind: 'wave', sub: 'CLERKS', list: ['clerk', 'clerk', 'counter', 'counter'] },
        { kind: 'wave', sub: 'AMBUSH', list: ['marksman', 'marksman', 'clerk', 'counter', 'lobber'], say: [['radio', 'Contact in the tram cut. Box it in.']] },
      ],
      clear: [['null', 'Stamped. Filed. Flung.'], ['rem', "The market's through that gate."]],
      next: 'INTO THE MARKET',
      frags: [[8.6, -47.5, "Dash, laughing in a hospital corridor: 'Count to ten, Iris. Bet you can't.'"], [49.3, -47.4, "Your first tattoo. Moth's hands shaking. 'Hold still. This one's important.'"]],
    },
    { // 3 PIER 9 MARKET
      spawns: [[-4, -62.5], [0, -62.5], [4, -62.5], [-6.3, -48.1], [6.3, -37.2], [-6.3, -40], [6.3, -58], [0, -29]],
      enter: [['rem', "Ninety-nine point nine nine nine seven percent. They're close, Iris."]],
      steps: [
        { kind: 'wave', sub: 'NIGHT MARKET', list: ['marksman', 'counter', 'counter', 'marksman', 'counter'], say: [['radio', 'Vendors, stay where you are. Remain countable.']] },
        { kind: 'wave', sub: 'LOBBERS — CATCH THE GRENADES', list: ['lobber', 'counter', 'marksman', 'counter', 'clerk'], say: [['rem', 'Grenades are countdowns. Countdowns are just counts. Catch one.']] },
        { kind: 'wave', sub: 'HOLD THE MARKET', list: ['warden', 'lobber', 'counter', 'marksman', 'counter'] },
      ],
      clear: [['moth', "Iris. It's Moth. There are people in the cold storage. Uncounted. The Census ships them out tonight."], ['null', 'On it.']],
      next: 'COLD STORAGE',
      frags: [[-6.5, -63.4, '2 a.m. noodles at the market. You paid cash. Nobody had used cash in years.'], [6.4, -28.2, "A billboard: ENUMERATION 97.2%. You remember thinking, that's not so close."]],
    },
    { // 4 COLD STORAGE
      spawns: [[-9.5, -61], [-9.5, -48], [-28, -48], [-28, -61], [-20, -47.5], [-16, -61]],
      enter: [['rem', 'Four cages. Rip the doors off. They know the way out.']],
      steps: [
        { kind: 'rescue', sub: 'FREE THE UNCOUNTED', list: ['counter', 'counter', 'clerk'], trickle: ['counter', 'clerk', 'marksman'], every: 16,
          say: [['moth', "Doors first. Don't throw them at anyone you're rescuing."]] },
      ],
      clear: [['moth', 'Got them. Four less on the manifest.'], ['null', 'Four more of us.'], ['rem', "Gut Lane's north of the market. Then the rail yard."]],
      next: 'NORTH TO GUT LANE',
      frags: [[-29.1, -46.9, 'A cage like these, at Halden. Not for keeping people in. For keeping the world out.'], [-8.5, -63.5, 'A drawing, folded small: a woman made of numbers. For Aunt Iris.']],
    },
    { // 5 GUT LANE
      spawns: [[-2.5, -90.5], [2.5, -90.5], [0, -89], [-3.4, -82], [3.4, -86], [0, -66]],
      enter: [['null', 'Someone painted my mark. My zero.'], ['rem', 'You did. Tuesday. You forgot.']],
      steps: [
        { kind: 'wave', sub: 'GUT LANE', list: ['lobber', 'counter', 'lobber', 'counter', 'marksman'], say: [['radio', 'Contact in Gut Lane. Pin it down. Grenades authorized.']] },
        { kind: 'wave', sub: 'SHIELD WALL', list: ['warden', 'warden', 'counter', 'lobber'], say: [['rem', 'Two shields in a narrow lane. Surge.']] },
      ],
      clear: [['radio', 'All units: lockdown in the rail yard. Nobody leaves Zone 4.'], ['rem', "Then we'd better be inside it."]],
      next: 'EAST TO THE RAIL YARD',
      frags: [[-3.9, -91.5, "Your own voice on a recording: 'If you're hearing this, I chose this.'"], [3.8, -65.2, 'Rain on a window. Dash counting the drops out loud. Stopping at zero.']],
    },
    { // 6 THE RAIL YARD
      spawns: [[76, -90], [76, -67.5], [60, -90.5], [48, -67.5], [36, -90.5], [60, -78], [31, -72]],
      enter: [['radio', 'Lockdown in effect. Lamplighter on approach.']],
      steps: [
        { kind: 'lockdown', sub: 'SURVIVE THE LOCKDOWN', time: 90, list: ['counter', 'counter', 'marksman'], trickle: ['counter', 'marksman', 'lobber', 'counter', 'warden', 'clerk', 'counter', 'marksman'], every: 7, cap: 6,
          say: [['rem', "Ninety seconds. They'll pour in. Use the boxcars."]] },
        { kind: 'lamplighter', sub: 'THE LAMPLIGHTER', list: ['lamplighter', 'counter', 'marksman'], adds: ['clerk', 'clerk', 'counter'],
          say: [['radio', 'Lamplighter, count the yard.'], ['rem', "If its light stays on you, it counts you. Keep out of the beam and throw high."]] },
      ],
      clear: [['rook', "I watched you stop time out there. The feed says I didn't. I'm choosing to believe my eyes."], ['rook', "You took down a Lamplighter. They'll send the Auditor now."], ['null', 'Let them.']],
      next: 'NORTH TO THE CONTAINER YARD',
      frags: [[77.4, -66.6, 'A boxcar manifest: 60,000 units. Origin: Tidelines. Destination: DENOMINATOR.'], [5.2, -81.5, "Halden Island from the ferry. You were holding someone's hand. You can't see whose."]],
    },
    { // 7 CONTAINER YARD
      spawns: [[78, -134], [42, -133], [78, -96], [60, -133], [50, -112], [78, -114], [41, -110], [24, -116]],
      enter: [['rook', 'There\'s an informant in the container yard carrying my route key. Catch him before he reports in, and the key is yours.']],
      steps: [
        { kind: 'chase', sub: 'CATCH THE INFORMANT', time: 40, say: [['rem', "He's fast. Grab him, or put something heavy in his way."]] },
        { kind: 'wave', sub: 'CONTAINER YARD', list: ['counter', 'marksman', 'warden', 'counter', 'lobber'] },
        { kind: 'wave', sub: 'TRANSIT SHED', list: ['counter', 'clerk', 'counter', 'marksman', 'warden'], say: [['radio', 'Auditor, proceed to Pier 9.']] },
      ],
      clear: [['rem', "Pier 9 is through the shed. He's waiting."]],
      next: 'THROUGH THE SHED TO PIER 9',
      frags: [[79.3, -135.3, 'A Census audit with your name blacked out. Forty-one times.'], [15.2, -121.4, "Iron-gall ink and burnt coffee. Moth's. Safe."]],
    },
    { // 8 PIER 9 DOCKS
      spawns: [[-10, -127], [0, -128], [8, -119], [-17, -112], [-6, -121], [4, -114], [-12, -104], [-17, -95]],
      enter: [['null', 'Lights. Under the water.'], ['rem', "Don't look too long."]],
      steps: [
        { kind: 'auditor1', sub: 'THE AUDITOR', list: ['auditor', 'counter', 'lobber', 'counter'], reinforce: ['counter', 'marksman'],
          say: [['radio', 'Auditor, you have the count.'], ['rem', 'He charges. Put a car in his way. Or a container.']] },
      ],
      clear: [['rem', "He walked into the sea. That's not a retreat, Iris. That's a reload."], ['radio', 'Auditor re-provisioned. Proceed to the ferry pier.']],
      next: 'OUT ONTO THE FERRY PIER',
      frags: [[-19.8, -93, "The lights under the water. You've seen them from below."], [13.6, -93, "REM's first word was your name. You never told it your name."]],
    },
    { // 9 FERRY PIER
      spawns: [[-60, -112], [-58, -106], [-58, -118], [-48, -105], [-48, -119], [-38, -105]],
      enter: [['rook', 'The last ferry to Halden Island left without passengers. Be careful.']],
      steps: [
        { kind: 'auditor2', sub: 'AUDIT', list: ['auditor', 'counter', 'marksman', 'lobber', 'warden'], reinforce: ['counter', 'marksman', 'counter', 'clerk'],
          say: [['rem', "Water on three sides. He's heavy. Heavy things sink."]] },
      ],
      clear: [['null', '...He said one.'], ['rem', "You're running hot. Moth's door, Iris. Back on the docks."]],
      next: 'GO BELOW PIER 9',
      frags: [[-61.4, -104.6, 'The last ferry to Halden. You were on it. You came back alone.'], [-61.4, -119.4, "Dash in the armor for the first time. 'One,' he says. 'I count you as one.'"]],
    },
  ],
  reinforce: [['radio', 'Reinforcements to the pier. Keep her counted.']],
  auditorRetreat: [['auditor', 'Re-provisioning.']],
  auditorDown: [['auditor', '...One.']],
  wardenShield: [['rem', 'Shield down. Pick it up. It works for us now.']],
  lamplighterHalf: [['radio', 'Lamplighter is taking damage. Clerks, assist.']],
  chaseCaught: [['rook', "Good. The key's on him. I owe you one, whoever you are."]],
  chaseLost: [['radio', 'Informant reporting: target in the container yard. All units converge.'], ['rem', "He got away. Now they know where we are."]],
  rescueOne: [['moth', "That's one. Go, go, go."]],
  ending: [
    ['moth', "You're late. Sit. Arm."],
    ['null', 'How many?'],
    ['moth', 'Forty-two marks. One more than this morning.'],
    ['null', 'What did I lose?'],
    ['moth', "If I knew, it wouldn't be lost."],
    ['rem', "Don't worry, Iris. I've got it."],
  ],
};
