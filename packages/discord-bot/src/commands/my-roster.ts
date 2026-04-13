import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';
import {
  getRosterForRace,
  calculateTeamSpending,
  calculateTeamValue,
  calculateJourneymenNeeded,
  getLinemanPosition,
  DRAFT_BUDGET
} from '../utils/roster-validator.js';

export const data = new SlashCommandBuilder()
  .setName('my-roster')
  .setDescription('View your complete team roster');

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const discordId = interaction.user.id;

  try {
    // Get user
    const { data: user } = await client.supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!user) {
      return await interaction.editReply('❌ You need to `/register` first!');
    }

    // Get team with all data
    const { data: teamOwnership } = await client.supabase
      .from('team_ownership')
      .select(`
        team:teams (
          id,
          name,
          race,
          tier,
          treasury,
          team_value,
          dedicated_fans,
          rerolls,
          assistant_coaches,
          cheerleaders,
          apothecary_hired,
          wins,
          losses,
          ties
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (!teamOwnership || !teamOwnership.team) {
      return await interaction.editReply('❌ You don\'t own a team! Use `/create-team` first.');
    }

    const team = teamOwnership.team as any;
    const roster = getRosterForRace(team.race);

    if (!roster) {
      return await interaction.editReply(`❌ Roster data not found for ${team.race}`);
    }

    // Get all players
    const { data: players } = await client.supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .eq('status', 'active')
      .order('number', { ascending: true });

    // Calculate spending
    const spending = calculateTeamSpending({
      players: players || [],
      rerolls: team.rerolls || 0,
      rerollCost: roster.rerollCost,
      assistantCoaches: team.assistant_coaches || 0,
      cheerleaders: team.cheerleaders || 0,
      hasApothecary: team.apothecary_hired || false,
      dedicatedFans: team.dedicated_fans || 1
    });

    const teamValue = calculateTeamValue({
      players: players || [],
      rerolls: team.rerolls || 0,
      rerollCost: roster.rerollCost,
      assistantCoaches: team.assistant_coaches || 0,
      cheerleaders: team.cheerleaders || 0,
      hasApothecary: team.apothecary_hired || false,
      dedicatedFans: team.dedicated_fans || 1
    });

    const journeymenNeeded = calculateJourneymenNeeded(players?.length || 0);
    const linemanPos = getLinemanPosition(roster);

    // Build player list
    let playerList = '';
    if (players && players.length > 0) {
      playerList = players.map(p =>
        `#${p.number} **${p.name}** (${p.position})`
      ).join('\n');
    } else {
      playerList = '*No players hired yet*';
    }

    // Add Journeymen if needed
    if (journeymenNeeded > 0 && linemanPos) {
      playerList += `\n\n**Journeymen** (${journeymenNeeded}):\n`;
      for (let i = 1; i <= journeymenNeeded; i++) {
        playerList += `J${i} ${linemanPos.name} [Loner (4+)]\n`;
      }
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`🏈 ${team.name}`)
      .setDescription(`${team.race} • Tier ${team.tier}`)
      .addFields(
        { name: '👥 Players', value: `${players?.length || 0} / 16${journeymenNeeded > 0 ? ` (+${journeymenNeeded} Journeymen)` : ''}`, inline: true },
        { name: '💰 Treasury', value: `${spending.treasury.toLocaleString()}`, inline: true },
        { name: '📈 Team Value', value: `${teamValue.toLocaleString()}`, inline: true },
        { name: '\u200b', value: '\u200b' }, // Blank line
        { name: '🎲 Rerolls', value: `${team.rerolls || 0} / ${roster.maxRerolls}`, inline: true },
        { name: '👨‍🏫 Asst Coaches', value: `${team.assistant_coaches || 0} / 6`, inline: true },
        { name: '📣 Cheerleaders', value: `${team.cheerleaders || 0} / 6`, inline: true },
        { name: '⚕️ Apothecary', value: team.apothecary_hired ? 'Yes' : 'No', inline: true },
        { name: '👥 Dedicated Fans', value: `${team.dedicated_fans || 1}`, inline: true },
        { name: '\u200b', value: '\u200b' }, // Blank line
        { name: '📊 Roster', value: playerList.substring(0, 1024) } // Discord field limit
      )
      .setFooter({ text: `Budget: ${DRAFT_BUDGET.toLocaleString()} | Spent: ${spending.totalSpent.toLocaleString()}` })
      .setTimestamp();

    // Add warning if under 11 players
    if ((players?.length || 0) < 11 && journeymenNeeded > 0) {
      embed.setColor(0xFFAA00); // Orange for warning
      embed.addFields({
        name: '⚠️ Warning',
        value: `You need at least 11 players. ${journeymenNeeded} Journeymen will be added for matches.`
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in my-roster:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
