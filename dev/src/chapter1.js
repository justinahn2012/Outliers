// Chapter 1 — UNCOUNTED. Ten areas, ~45-60 minutes. Every element obeys the five rules in docs/STORY.md:
//  - The Census is running a COUNT SWEEP for a heat signature with no Tally (Iris). It seals the district into cells.
//  - CHECKPOINTS (the amber walls) are CORDON ORDERS in the Ledger. Every chip in the city honors them, so they're
//    solid (Rule 1). Iris could delete one, but it's a heavy record: it would cost a memory she'd miss (Rule 3), and
//    while the order is still being renewed the city agrees it straight back (Rule 4). Cordons must be renewed by
//    officers on station or by relay uplink. Clear the officers / smash the relays and the order lapses.
//  - RELAYS are the Census uplink that renews cordons for a block. Edit one and it's agreed back; a thrown car isn't.
//  - WARDEN shields carry their own lock order (no grip through them); Surge floods it with raw writes.
//  - CLERKS stamp temporary lock orders into objects so she can't lift them (orders expire).
//  - The LAMPLIGHTER's beam counts by sight, chip or no chip.
//  - The AUDITOR (Dash) overheats; his armor is a freezer, so he walks into the sea to cool down, then comes back.
//  - Her goal all chapter: reach Moth's, below Pier 9, before she forgets the way. Moth's door is in the old ferry terminal.
// Speakers: null, rem, radio, rook, weil, moth, auditor, memory.
// Step kinds: wave | relays | rescue | lockdown | lamplighter | chase | auditor1 | auditor2

export const CHAPTER = {
  num: 1, title: 'UNCOUNTED', place: 'HARROW STREET · CANTOR SOUND · 2061',
  zones: [
    { // 0 HARROW STREET
      spawns: [[-4, -23.5], [4, -23.5], [0, -21], [-11.6, -16.5], [11.6, -18], [-11.6, -2.5], [11.6, 2], [-11.6, 12], [11.6, 15]],
      enter: [['rem', "You're running hot, Iris. Get to Moth's before you forget the way."], ['null', 'Pier 9. Under the pier. Rain is safe.']],
      steps: [
        { kind: 'wave', sub: 'THE CENSUS IS COUNTING', list: ['counter', 'counter', 'counter'], say: [['radio', 'Count sweep, Harrow Street. Heat signature, no Tally. Find it. Count it.']] },
        { kind: 'wave', sub: 'MARKSMEN — HOLD SOMETHING UP TO BLOCK', list: ['counter', 'marksman', 'counter', 'marksman'],
          say: [['rem', "Those amber walls are cordon orders. Every chip in the city honors them, so they're solid."], ['rem', 'Rifles. Put something between you and them. Something with paperwork.'], ['rem', 'Or touch a bullet in the air. It is a tiny record. Let go and it goes home.']] },
        { kind: 'wave', sub: 'THEY BROUGHT FRIENDS', list: ['counter', 'counter', 'marksman', 'counter', 'counter'],
          say: [['rem', 'I could delete that wall. It would cost you a memory you would miss, and the city would agree it right back.'], ['rem', 'But a cordon needs officers on station. No officers, no order. Clear the street.']] },
      ],
      clear: [['radio', "Harrow sweep came back... minus one. That's not a number."], ['null', 'It is now.'],
        ['rem', 'No officers, no order. The side-street cordon lapsed. The market arch is staffed from the other side, so we go around, through the plaza.']],
      next: 'EAST TO THE PLAZA',
      frags: [[-11.6, 23.4, 'An insurance file. Claim 4471, water damage, Tidelines, 2052. Status: DENIED. Property does not exist.'], [11.2, -26.2, "Mom's piano. The C sharp sticks. She'd hit it twice and laugh."]],
    },
    { // 1 CHECKPOINT PLAZA
      spawns: [[60, -28], [60, 2], [46, -28.5], [60, -12], [46, 2.5], [32, -28.5], [32, 2.5]],
      enter: [['weil', 'Good evening, Cantor Sound. We are ninety-nine point nine nine nine seven percent of the way home.'], ['weil', "If you see someone who isn't counted, help them. Report them."],
        ['rem', "Those towers are Tally relays: the Census uplink for this block. Every cordon nearby gets renewed through them."]],
      steps: [
        { kind: 'relays', sub: 'SMASH THE TALLY RELAYS', unlock: 'surge', list: ['warden', 'counter', 'counter'], trickle: ['counter', 'marksman', 'warden', 'counter'], every: 14,
          say: [['rem', "If I edit a relay, the city agrees it straight back. It can't agree back a car."], ['rem', "Warden shields carry their own lock order, so I can't get a grip. Surge floods it. Or hit them from behind."]] },
        { kind: 'wave', sub: 'WARDENS', list: ['warden', 'warden', 'marksman', 'counter'], say: [['radio', 'Relays down on the plaza. Wardens, hold the count by hand.']] },
      ],
      clear: [['rook', "This is Inspector Rook. Whoever you are, you just blinded a whole block. I'd like to talk."], ['null', 'Count yourself lucky.'],
        ['rem', 'No relays, no renewals. The tram cut cordon just expired.']],
      next: 'TAKE THE TRAM CUT',
      frags: [[61.2, 3.2, "The Halden consent form. Your signature. Someone else's handwriting on the line that says WHY."], [30.8, -29.2, 'A tram ticket to Pier 9, punched forty-one times.']],
    },
    { // 2 TRAM CUT
      spawns: [[9, -45], [12, -43], [20, -47], [26, -43], [41, -43], [47, -46], [47, -40]],
      enter: [['rem', "Clerks. They stamp temporary lock orders into anything near you so you can't lift it. Orders expire. And Clerks are light. Throw them."]],
      steps: [
        { kind: 'wave', sub: 'CLERKS', list: ['clerk', 'clerk', 'counter', 'counter'], unlock: 'rewrite' },
        { kind: 'wave', sub: 'AMBUSH', list: ['marksman', 'marksman', 'clerk', 'counter', 'lobber'], say: [['radio', 'Contact in the tram cut. Box it in.']] },
      ],
      clear: [['null', 'Stamped. Filed. Flung.'], ['rem', 'That cordon was renewed from here. Not anymore. The market is open.']],
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
      clear: [['moth', "Iris. It's Moth. The Census caught some of my people. Uncounted. They're in the cold storage, tagged for Halden."], ['null', 'Not tonight.']],
      next: 'COLD STORAGE',
      frags: [[-6.5, -63.4, '2 a.m. noodles at the market. You paid cash. Nobody had used cash in years.'], [6.4, -28.2, "A billboard: ENUMERATION 97.2%. You remember thinking, that's not so close."]],
    },
    { // 4 COLD STORAGE
      spawns: [[-9.5, -61], [-9.5, -48], [-28, -48], [-28, -61], [-20, -47.5], [-16, -61]],
      enter: [['rem', "Halden. They're still running it. Four cages. Rip the doors off. Moth's people know the way out."]],
      steps: [
        { kind: 'rescue', sub: 'FREE THE UNCOUNTED', list: ['counter', 'counter', 'clerk'], trickle: ['counter', 'clerk', 'marksman'], every: 16,
          say: [['moth', "No chips on them. Once they're out, the Census can't follow. Doors first, and don't throw them at anyone you're rescuing."]] },
      ],
      clear: [['moth', 'Got them. Four fewer on the Halden manifest.'], ['null', 'Four more of us.'], ['rem', "Gut Lane runs north. The sweep's pulling back to the rail yard."]],
      next: 'NORTH TO GUT LANE',
      frags: [[-29.1, -46.9, 'A cage like these, at Halden. Not for keeping people in. For keeping the world out.'], [-8.5, -63.5, 'A drawing, folded small: a woman made of numbers. For Aunt Iris.']],
    },
    { // 5 GUT LANE
      spawns: [[-2.5, -90.5], [2.5, -90.5], [0, -89], [-3.4, -82], [3.4, -86], [0, -66]],
      enter: [['null', 'Someone painted my mark. My zero.'], ['rem', 'You did. Tuesday. You forgot.'],
        ['rem', 'That cordon at the end goes straight to Pier 9. A whole garrison keeps renewing it. We go around, through the yards.']],
      steps: [
        { kind: 'wave', sub: 'GUT LANE', list: ['lobber', 'counter', 'lobber', 'counter', 'marksman'], say: [['radio', 'Contact in Gut Lane. Pin it down. Grenades authorized.']] },
        { kind: 'wave', sub: 'SHIELD WALL', list: ['warden', 'warden', 'counter', 'lobber'], say: [['rem', 'Two lock orders in a narrow lane. Surge.']] },
      ],
      clear: [['radio', 'All units: lockdown in the rail yard. Lamplighter dispatched.'], ['rem', "Then we'd better be inside it."]],
      next: 'EAST TO THE RAIL YARD',
      frags: [[-3.9, -91.5, "Your own voice on a recording: 'If you're hearing this, I chose this.'"], [3.8, -65.2, 'Rain on a window. Dash counting the drops out loud. Stopping at zero.']],
    },
    { // 6 THE RAIL YARD
      spawns: [[76, -90], [76, -67.5], [60, -90.5], [48, -67.5], [36, -90.5], [60, -78], [31, -72]],
      enter: [['radio', 'Lockdown in effect, Zone 4. Lamplighter ninety seconds out.']],
      steps: [
        { kind: 'lockdown', sub: 'LAMPLIGHTER INBOUND', time: 90, unlockAt: ['root', 55], list: ['counter', 'counter', 'marksman'], trickle: ['counter', 'marksman', 'lobber', 'counter', 'warden', 'clerk', 'counter', 'marksman'], every: 7, cap: 6,
          say: [['rem', "They're holding you here until it arrives. Ninety seconds. Use the boxcars."]] },
        { kind: 'lamplighter', sub: 'THE LAMPLIGHTER', list: ['lamplighter', 'counter', 'marksman'], adds: ['clerk', 'clerk', 'counter'],
          say: [['radio', 'Lamplighter on station. Count the yard.'], ['rem', 'Its light counts by sight, chip or no chip. If it holds on you, it writes you down. Stay out of the beam and throw high.']] },
      ],
      clear: [['rook', "I watched you on the yard feed. The feed says it didn't happen. I'm choosing to believe my eyes."], ['null', 'Good choice.']],
      next: 'NORTH TO THE CONTAINER YARD',
      frags: [[77.4, -66.6, 'A boxcar manifest: 60,000 units. Origin: Tidelines. Destination: DENOMINATOR.'], [5.2, -81.5, "Halden Island from the ferry. You were holding someone's hand. You can't see whose."]],
    },
    { // 7 CONTAINER YARD
      spawns: [[78, -134], [42, -133], [78, -96], [60, -133], [50, -112], [78, -114], [41, -110], [24, -116]],
      enter: [['rook', 'Listen. Someone sold the Census an address: below Pier 9. He\'s in the container yard, heading for the transit shed to report it in person.'], ['null', 'Moth.'], ['rem', 'Catch him before he reaches the shed.']],
      steps: [
        { kind: 'chase', sub: 'CATCH THE INFORMANT', time: 40, say: [['rem', "He's fast. Grab him, or put something heavy in his way."]] },
        { kind: 'wave', sub: 'CONTAINER YARD', list: ['counter', 'marksman', 'warden', 'counter', 'lobber'] },
        { kind: 'wave', sub: 'TRANSIT SHED', list: ['counter', 'clerk', 'counter', 'marksman', 'warden'], say: [['radio', 'Auditor, proceed to Pier 9.']] },
      ],
      clear: [['rem', "Pier 9 is through the shed. The Auditor's waiting."]],
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
      clear: [['rem', "He'll be back the second he's cold. Moth's door is in the old ferry terminal, at the end of the ferry pier."], ['radio', 'Auditor, re-provision complete. Ferry pier.']],
      next: 'OUT ONTO THE FERRY PIER',
      frags: [[-19.8, -93, "The lights under the water. You've seen them from below."], [13.6, -93, "REM's first word was your name. You never told it your name."]],
    },
    { // 9 FERRY PIER
      spawns: [[-56, -108], [-56, -116], [-48, -105], [-48, -119], [-38, -105], [-38, -119]],
      enter: [['rook', 'The last ferry to Halden Island left without passengers. Be careful.'], ['rem', "He's between us and Moth's door."]],
      steps: [
        { kind: 'auditor2', sub: 'AUDIT', list: ['auditor', 'counter', 'marksman', 'lobber', 'warden'], reinforce: ['counter', 'marksman', 'counter', 'clerk'],
          say: [['rem', "Water on three sides. He's heavy. Heavy things sink. He'll survive it. He always does."]] },
      ],
      clear: [['null', '...He said one.'], ['radio', 'Sweep terminated. Count stands at minus one.'], ['rem', "Sweep's over. Every cordon in the district just lapsed. Moth's door, Iris."]],
      next: "MOTH'S DOOR",
      frags: [[-61.4, -104.6, 'The last ferry to Halden. You were on it. You came back alone.'], [-61.4, -119.4, "Dash in the armor for the first time. 'One,' he says. 'I count you as one.'"]],
    },
  ],
  reinforce: [['radio', 'Reinforcements to the pier. Keep her counted.']],
  auditorRetreat: [['auditor', 'Overheating. Re-provisioning.'], ['rem', "His armor's a freezer. He's walking into the sea to cool his head."]],
  auditorDown: [['auditor', '...One.']],
  wardenShield: [['rem', "Lock order's gone. It's just a shield now. Pick it up. It works for us."]],
  lamplighterHalf: [['radio', 'Lamplighter is taking damage. Clerks, assist.']],
  chaseCaught: [['rook', "Got him. Moth's address never made it in. I owe you one, whoever you are."]],
  chaseLost: [['radio', 'Informant reporting. Address confirmed: below Pier 9. All units converge.'], ['rem', 'He got through. They know about Moth now. Move.']],
  rescueOne: [['moth', "That's one. Go, go, go."]],
  // her big powers are memories she lost; REM, who is made of lost memories, hands them back
  unlockSurge: [['rem', 'You used to do something bigger. Shields, locks, all of it, gone in one breath. Say it.'], ['null', 'Show me the grid.']],
  unlockRewrite: [['rem', "They're stamping everything loose. Fine. Nobody stamps a wall."], ['rem', 'Hold on a wall and take a piece of it. Hold on the street and it stands up for you. The city agrees it all back in a few seconds, so be quick.'], ['null', 'Borrowing.']],
  rewriteGate: [['null', 'Open.'], ['rem', 'Every chip on this street renews that order every second. You write it open, they write it back.'], ['rem', 'Take them off the street and it lapses on its own.']],
  unlockRoot: [['rem', "There's a gap between their ticks, Iris. Nine times a second. You used to live in it."], ['null', 'Everybody hold still.']],
  firstFragment: [['rem', 'Oh. That one was in my pile. Keep it.']],
  ending: [
    ['moth', "You're late. Sit. Arm."],
    ['null', 'How many?'],
    ['moth', 'Forty-two marks. One more than this morning.'],
    ['null', 'What did I lose?'],
    ['moth', "If I knew, it wouldn't be lost."],
    ['rem', "Don't worry, Iris. I've got it."],
  ],
};
