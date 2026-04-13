/**
 * Import Blood Bowl 2020 Skills and Traits into the database
 * Run with: SUPABASE_SERVICE_ROLE_KEY="your-key" node packages/database/scripts/import-skills-traits.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Get it from: supabase status');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" node packages/database/scripts/import-skills-traits.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Blood Bowl 2020 Skills (all categories)
const skills = [
  // General Skills
  { name: 'Block', category: 'General', description: 'This player may reroll either or both dice when making a Block action, providing they did not roll Defender Stumbles or Defender Down on both dice.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Dauntless', category: 'General', description: 'When making a Block action, before rolling any dice, this player may perform a Dauntless action. Roll a D6, adding this player\'s Strength and subtracting the target player\'s Strength. On a 1 or less this player loses their Tackle Zone for the Block action. On a 2+ this player treats their Strength as being equal to their opponent\'s.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Dirty Player (+1)', category: 'General', description: 'When this player performs a Foul action, they may roll an extra D6. If they have this skill twice, they roll two extra D6, etc.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Fend', category: 'General', description: 'If an opposition player makes a Block or Blitz action and is adjacent to this player, after moving this player may choose to prevent the opposition player from following up. The opposition player may follow up if they make the block as part of a Blitz action, or if the block resulted in a turnover.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Frenzy', category: 'General', description: 'After a Block or Blitz action if an opposition player is pushed back but not Down, this player must follow up and perform a second Block action against the same player. If the first block caused a turnover, the second block is not made. If this player is also adjacent to one or more Standig opposition players after the first block, this player may choose not to follow up and make the second block.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Grab', category: 'General', description: 'When a player with Grab makes a Block action, they may choose which square the pushed back player is moved to (still obeying normal push back rules).', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Guard', category: 'General', description: 'When a teammate makes a Block action, this player may assist as long as they are in range to do so (even if they are being Marked).', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Kick', category: 'General', description: 'If this player is nominated to be the kicker when their team takes a kick-off, they may add +1 when rolling to see if the kick scatters.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Shadowing', category: 'General', description: 'If an opposition player within this player\'s Tackle Zone moves for any reason, this player may Shadow that player. Roll a D6: on a 2+ this player may move one square in the same direction as the moving player, ignoring their Tackle Zones. If unable or unwilling to move a square, this player stays put. This move does not count against their Movement Allowance next turn.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Sidestep', category: 'General', description: 'When this player is pushed back, they may choose which square they are moved to (still obeying push back rules).', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Strip Ball', category: 'General', description: 'When an opposition player falls over as the result of this player performing a Block action, or being pushed back by this player, the opposition player will automatically drop the ball if carrying it.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Sure Hands', category: 'General', description: 'This player may re-roll a failed Agility test to pick up the ball. In addition, this player may ignore the effects of enemy tackle zones when picking up the ball (do not subtract from their Agility characteristic).', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Tackle', category: 'General', description: 'When making a Block action, this player may choose to ignore the effects of the opposition player\'s Dodge, Sidestep, and Diving Tackle skills.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Wrestle', category: 'General', description: 'When this player performs a Block action they may choose to automatically treat a single Both Down result as if a Wrestle result had been rolled instead. For the purposes of this skill, Both Down includes rolls where the active player is  required to pick Both Down due to skills or other effects.', official_reference: 'BB2020 Rulebook p.77' },

  // Agility Skills
  { name: 'Catch', category: 'Agility', description: 'This player may re-roll any failed Agility test when attempting to catch the ball, or when attempting to intercept or catch a pass. In addition, if this player is Knocked Down or placed Prone at any time other than during their own activation, they may apply a +1 modifier to their Agility characteristic when making an Agility test to catch a Pass that was already in the air when they were Knocked Down or placed Prone.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Defensive', category: 'Agility', description: 'When this player performs an Interfere action when their team is on Defence, this player adds +1 to the dice roll.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Diving Catch', category: 'Agility', description: 'If this player fails to catch the ball, you may re-roll the Agility test. However, regardless of the result this player is placed Prone after the re-roll.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Diving Tackle', category: 'Agility', description: 'If an opposition player within this player\'s Tackle Zone attempts to Dodge, this player may declare they are using this skill. The opposition player must then subtract 2 from their Agility characteristic when making the Dodge roll. If the Dodge roll is failed, the opposition player is Knocked Down as normal. If the Dodge roll is successful, or was not taken due to the opposition player having a skill that allows them to ignore Tackle Zones, this player is placed Prone.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Dodge', category: 'Agility', description: 'This player may re-roll a failed Agility test when attempting to Dodge.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Jump Up', category: 'Agility', description: 'If this player is Prone they may stand up for free (they do not have to pay 3 squares of Movement) during their activation. They may also choose to Jump Up at the start of any Block action they perform instead of standing up at the start of their activation, if they wish.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Leap', category: 'Agility', description: 'During their movement, instead of moving normally this player may leap to any empty square within 2 squares, in any direction, ignoring tackle zones and falling over (and being tackled) if they land in a square within an opposition player\'s tackle zone. They may attempt a leap once per turn. Roll a D6: on a 1 they fail and are placed prone in the target square; on a 2+ they land safely.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Safe Pair of Hands', category: 'Agility', description: 'If this player is Knocked Down or placed Prone (but not if they fall over) whilst in possession of the ball, the ball does not bounce. Instead, you may place it in any adjacent square.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Sprint', category: 'Agility', description: 'When this player performs a Move action or a Blitz action (but not any other type of action), they may attempt to Rush up to three times, instead of only once as normal.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Sure Feet', category: 'Agility', description: 'This player may re-roll the D6 when attempting to Rush.', official_reference: 'BB2020 Rulebook p.77' },

  // Strength Skills
  { name: 'Arm Bar', category: 'Strength', description: 'When an opposition player falls over as the result of this player blocking them, you may apply a +1 modifier to the Armour roll or Injury roll. You must choose which before rolling.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Brawler', category: 'Strength', description: 'When this player performs a Block action, they may re-roll a single Both Down result, should they wish to.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Break Tackle', category: 'Strength', description: 'When this player makes an Agility test to Dodge, they may use their Strength characteristic instead of their Agility characteristic, if they wish.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Juggernaut', category: 'Strength', description: 'When this player performs a Blitz action, they are not Knocked Down if they push back an opposition player with a Wrestle skill that chooses to use that skill. Additionally, this player may ignore the effects of the Fend and Stand Firm skills (though the target player will still not be pushed back by a successful block roll).', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Mighty Blow (+1)', category: 'Strength', description: 'When an opposition player is Knocked Down as the result of a Block action performed by this player, you may modify the Armour roll or Injury roll by the amount shown in brackets. You must choose which before rolling. If this player has this skill more than once, the modifier is cumulative.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Multiple Block', category: 'Strength', description: 'When this player performs a Block action, they may choose to throw blocks against two opposition players that are within their Tackle Zones and adjacent to each other (rather than one as normal). Make a separate dice roll for each Block. The first Block is made as per a normal Block action, but this player may not follow-up unless the second Block is not performed. This player must have a Strength characteristic of 4 or more to use this skill.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Piling On', category: 'Strength', description: 'When an opposition player is Knocked Down by this player as the result of a Block, you may apply a +1 modifier to either the Armour roll or Injury roll. This modifier may be applied after the roll is made, and you may only use it once per player per turn. If you do use this skill, this player is placed Prone (after any Armour or Injury rolls are made) and their activation ends immediately.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Stand Firm', category: 'Strength', description: 'This player may choose not to be pushed back as the result of a Block. They will still be Knocked Down by a Defender Down result, but will not be moved. If this player also has the Fend skill, they may choose which to use.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Thick Skull', category: 'Strength', description: 'When this player suffers a Casualty result on the Injury table, you may apply a -1 modifier to the roll.', official_reference: 'BB2020 Rulebook p.77' },

  // Passing Skills
  { name: 'Accurate', category: 'Passing', description: 'When this player performs a Pass action, you may apply a +1 modifier to the Agility test to pass the ball.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Cannoneer', category: 'Passing', description: 'When this player performs a Throw Bomb Special action, they may choose to reduce the Range of the throw by one category to apply a +1 modifier to the Agility test. For example, a Long Pass would become a Short Pass with a +1 modifier to the Agility test.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Cloud Burster', category: 'Passing', description: 'When this player performs a Throw Team-Mate action, they do not suffer the standard -1 modifier for Disturbing Presence.', official_reference: 'BB2020 Rulebook p.75' },
  { name: 'Dump-Off', category: 'Passing', description: 'If an opposition player declares a Block or Blitz action targeting this player, this player may immediately perform a Quick Pass action, interrupting the opposition player\'s activation. This Quick Pass action must be resolved before the opposition player\'s action can continue.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Fumblerooskie', category: 'Passing', description: 'Once per team turn, if this player is in possession of the ball at the start of their activation, they may choose to intentionally drop the ball. The ball will bounce before this player\'s activation continues as normal.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Hail Mary Pass', category: 'Passing', description: 'When this player performs a Pass action and wishes to pass the ball to a square that is not in a range category (i.e., in a Hail Mary range), their Passing Ability is 4+ instead of 6+ and they may apply re-rolls to this Agility test as normal.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Leader', category: 'Passing', description: 'Once per half, if this player is on the pitch and has not been Sent-off, you may use this skill to gain one additional Team Re-roll.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Nerves of Steel', category: 'Passing', description: 'This player may ignore any enemy Tackle Zones when they perform a Pass action or attempt to catch the ball.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'On the Ball', category: 'Passing', description: 'During the Start of Drive sequence, after setting up but before the kick-off, if this player is on the pitch they may move up to D3 squares (chosen by you). This movement may take them into the opposition half of the pitch.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Pass', category: 'Passing', description: 'When this player performs a Pass action, you may re-roll the Agility test to pass the ball.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Running Pass', category: 'Passing', description: 'If this player performs a Quick Pass action or a Pass action (not any other type), they may move a number of squares equal to their Movement Allowance before passing the ball. They may also attempt to Rush once before they perform the Quick Pass or Pass action, and may Rush once more after passing the ball, and may Go For It after the Rush.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Safe Pass', category: 'Passing', description: 'If a pass made by this player is intercepted, treat the Interception roll as if it were a failed catch and the ball will bounce from the square the interception was made.', official_reference: 'BB2020 Rulebook p.77' },

  // Mutation Skills
  { name: 'Big Hand', category: 'Mutation', description: 'This player may ignore the opposition Tackle Zones when they attempt to pick up the ball.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Claws', category: 'Mutation', description: 'When an opposition player is Knocked Down as the result of a Block action performed by this player, you may apply a +1 modifier to the Armour roll.', official_reference: 'BB2020 Rulebook p.75' },
  { name: 'Disturbing Presence', category: 'Mutation', description: 'Any opposition player that wishes to perform a Pass action, throw a bomb, or attempt to interfere with a pass whilst within 3 squares of this player must apply a -1 modifier to the Agility test.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Extra Arms', category: 'Mutation', description: 'This player may apply a +1 modifier to all Agility tests made to perform a Catch, Intercept, or Pick-up action.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Foul Appearance', category: 'Mutation', description: 'Any opposition player that wishes to perform a Block action that targets this player must first make an Agility test. If the test is failed, the player loses their Tackle Zone and cannot perform the Block action. The opposition player may perform a different action instead.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Horns', category: 'Mutation', description: 'When this player performs a Blitz action, they may apply a +1 modifier to their Strength characteristic when making their Block action.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Prehensile Tail', category: 'Mutation', description: 'Any opposition player that attempts to Dodge whilst in this player\'s Tackle Zone must apply a -1 modifier to the Agility test. In addition, if an opposition player becomes adjacent to this player during their movement, place a Tackle Zone marker adjacent to that player, and the Dodge roll must be taken.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Tentacles', category: 'Mutation', description: 'If an opposition player that is within this player\'s Tackle Zone wishes to move to a different square, that player must first make an Agility test, applying a -2 modifier. If the test is failed the player may not move and their activation ends. If the test is passed, they may move freely as normal.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Two Heads', category: 'Mutation', description: 'This player may apply a +1 modifier to all Agility tests to Dodge.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Very Long Legs', category: 'Mutation', description: 'When this player attempts to interfere with a pass, they may apply a +2 modifier to the Agility test. In addition, this player treats Jump Up as if they had the Jump Up skill.', official_reference: 'BB2020 Rulebook p.77' },
];

// Blood Bowl 2020 Traits (negative/special characteristics)
const traits = [
  { name: 'Always Hungry', description: 'If this player wishes to perform a Throw Team-mate action, roll a D6. On a roll of 1, the player cannot resist and will attempt to eat the unfortunate teammate. Roll for an Injury as if the player had been Knocked Down. The player is then Prone and the team turn ends. On a 2+ the Throw Team-mate action proceeds as normal.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Animosity (X)', description: 'During their activation, before performing any action, this player must perform an Animosity test. Roll a D6. On a 1, this player becomes Too Angry and their activation ends immediately. If the target(s) of the Animosity is/are on the pitch and Standing, this player may re-roll a failed Animosity test. Too Angry: Place a Too Angry marker next to the player. Until the end of the player\'s next activation, this player cannot voluntarily move and may not be selected to perform any action.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Ball & Chain', description: 'At the start of this player\'s team turn and after they perform an action, roll a D6. On a 1, this player moves 3 squares in a random direction (D8) determined by the scatter template. They will be placed Prone if they collide with the sideline or a Standing player. If they collide with a Standing player, roll a D6 for both players. On a roll of 4+, that player is Knocked Down. If this player is Knocked Down as a result, do not roll on the Armour or Injury table. If this player attempts to Move or perform a Block or Blitz action, they will move D3 squares in a random direction (D8), as described previously. Roll the number of dice equal to the result of the D3 to determine the direction moved. After this movement, this player may complete their action if possible.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Bone Head', description: 'During their activation, before performing any action, this player must perform a Bone Head test. Roll a D6. On a 1, place a Really Stupid marker next to this player. This player is Really Stupid until the end of their activation, and cannot voluntarily move or be selected to perform any action.', official_reference: 'BB2020 Rulebook p.74' },
  { name: 'Decay', description: 'Each time this player suffers a Casualty result on the Injury table, even if the player has the Regeneration skill, roll a D6. On a roll of 1 or 2, this player suffers a -1 modifier to a randomly selected characteristic (1-2 MA, 3-4 ST, 5-6 AV) to a minimum of 1. If any characteristic is reduced to 0, the player must miss the next game.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Hypnotic Gaze', description: 'Once per turn, this player may perform a Hypnotic Gaze action. Target an opposition player who is both adjacent to and within this player\'s Tackle Zone. Both players make an Agility test. If this player passes and the opposition player fails, the opposition player loses their Tackle Zone until the end of this turn. If both players pass or both fail, nothing happens. If this player fails and the opposition player passes, this player loses their Tackle Zone until the end of this turn.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'Loner (X+)', description: 'If this player wishes to use a Team Re-roll, roll a D6. On a roll equal to or higher than the value shown in brackets, this player can use the Team Re-roll as normal. Otherwise, the original result stands without a Team Re-roll being used.', official_reference: 'BB2020 Rulebook p.76' },
  { name: 'No Hands', description: 'This player may never perform a Pass action, catch, intercept, or pick up the ball.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Projectile Vomit', description: 'Once per game, if an opposition player is adjacent to and within this player\'s Tackle Zone during their activation (before they perform any action), this player may perform a Projectile Vomit action. Roll a D6. On a 1, nothing happens. On a 2+, the opposition player is Knocked Down.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Really Stupid', description: 'During their activation, before performing any action, this player must perform a Really Stupid test unless an adjacent teammate without the Loner (X+), Really Stupid, or Stunty traits is standing adjacent to them. Roll a D6. On a 1, place a Really Stupid marker next to this player. This player is Really Stupid until the end of their activation, and cannot voluntarily move or be selected to perform any action.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Regeneration', description: 'If this player suffers a Casualty result on the Injury table (or would do before any modifiers for skills such as Thick Skull or Stunty are applied), roll a D6. On a 4, 5, or 6, the Casualty result is ignored and the player is placed in the Reserves box instead of the Casualty box.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Right Stuff', description: 'This player may be thrown by a teammate with the Throw Team-mate skill. They do not have to Roll Over (and will not become Prone) when landing if the throw is accurate. If the throw is inaccurate and scatters into an occupied square, or off the pitch, this player becomes Prone as normal. If this player is holding the ball when thrown and the throw is accurate, there is no need to test to see if they drop the ball.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Secret Weapon', description: 'During the End of Drive sequence, before any dead or injured players go into the Reserves box, the referee will check for Secret Weapons. Roll a D6 for each player with this trait. On a 1, they have been caught using their secret weapon and are Sent-off.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Stab', description: 'Instead of performing a Block action (on their own or as part of a Blitz), this player may perform a Stab Special action. Pick a single Standing opposition player in an adjacent square and make an Armour roll (and possibly Injury roll) against that player. If this player is Placed Prone or is Knocked Down after using this skill, they become the victim of a Turnover as normal.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Stunty', description: 'When this player makes a Dodge roll, you may apply a +1 modifier to the dice roll. In addition, this player may apply a -1 modifier to any Injury roll made against them. However, this player cannot be nominated as the target of a Pass action or Hand-off action. In addition, they are allowed to attempt to Rush when Prone and attempting to stand up; if the Rush roll is successful they may continue to move after standing up.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Swarming', description: 'During the Start of Drive sequence, after both teams have set up, for each player with this trait on the Active team that has been placed in the Reserves box or the Knocked-Out box, you may roll a D6. On a 4+, that player may be set up on the pitch (in the Active team\'s half, and as if they were part of the original set-up).', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Take Root', description: 'After this player has performed an action or has been activated to perform a Move action but did not move (i.e., this player declared that they would perform a Move action but chose not to), place a Take Root marker next to them. Whilst the marker is in place, this player may not move or be moved, voluntarily or otherwise, until the marker is removed. They may Block or perform a Special action (or a Pass action if they have the Throw Team-mate skill), and will be Prone if they are Pushed Back. If the player suffers a Knocked Down result (or a Pushed Back result that results in the player being pushed off the pitch or pushed into an occupied square), they are Knocked Down, the marker is removed, and they are Prone as normal.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Throw Team-Mate', description: 'During their activation, this player may perform a Throw Team-mate action. Select a Standing team-mate with the Right Stuff trait that is in an adjacent square. Roll a D6, on a 1, the thrown player is Knocked Down in the square they currently occupy. On a 2+, the thrown player is thrown and will land in any square nominated by the opposition coach. An accurate throw does not scatter.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Titchy', description: 'This player may apply a +1 modifier to any Dodge roll they make. In addition, they may apply a -1 modifier to any Agility test they make to attempt to pick up the ball, or to attempt to catch the ball. On a 2+, that player may be set up on the pitch (in the Active team\'s half, and as if they were part of the original set-up).', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Timmm-ber!', description: 'If an opposition player performs a Block action against this player (either as part of a Block action or a Blitz action), they do not modify the number of dice rolled by using assists or the Guard skill. If a Blitz action is declared against this player, the active player may use the block dice as normal and make an unmodified dice roll to block this player before moving.', official_reference: 'BB2020 Rulebook p.77' },
  { name: 'Unchannelled Fury', description: 'If this player performs a Block action as part of a Blitz action, once the Block action is resolved the player must make an Agility test. If this test is failed, this player is placed Prone and their activation ends.', official_reference: 'BB2020 Rulebook p.77' },
];

async function importSkillsAndTraits() {
  console.log('Importing Blood Bowl 2020 Skills and Traits...\n');

  try {
    // Clear existing data
    console.log('Clearing existing skills and traits...');
    await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('traits').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Import Skills
    console.log(`Importing ${skills.length} skills...`);
    const { data: skillsData, error: skillsError } = await supabase
      .from('skills')
      .insert(skills);

    if (skillsError) {
      console.error('Error importing skills:', skillsError);
      throw skillsError;
    }

    console.log(`✓ Inserted ${skills.length} skills`);

    // Import Traits
    console.log(`\nImporting ${traits.length} traits...`);
    const { data: traitsData, error: traitsError } = await supabase
      .from('traits')
      .insert(traits);

    if (traitsError) {
      console.error('Error importing traits:', traitsError);
      throw traitsError;
    }

    console.log(`✓ Inserted ${traits.length} traits`);

    console.log('\n✅ Import complete!');
    console.log(`\nTotal: ${skills.length} skills + ${traits.length} traits = ${skills.length + traits.length} entries`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importSkillsAndTraits();
