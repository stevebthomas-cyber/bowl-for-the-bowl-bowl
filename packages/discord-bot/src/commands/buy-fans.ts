import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import {
  getRosterForRace,
  calculateTeamSpending,
  DEDICATED_FAN_COST,
  MAX_DEDICATED_FANS
} from '../utils/roster-validator.js';

export const data = new SlashCommandBuilder()
  .setName('buy-fans')
  .setDescription('Purchase dedicated fans')
  .addIntegerOption(option =>
    option
      .setName('count')
      .setDescription('Number of dedicated fans to purchase')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(2)
  );

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const count = interaction.options.getInteger('count', true);
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

    // Get team
    const { data: teamOwnership } = await client.supabase
      .from('team_ownership')
      .select(`
        team:teams (
          id,
          name,
          race,
          treasury,
          rerolls,
          assistant_coaches,
          cheerleaders,
          apothecary_hired,
          dedicated_fans
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

    // Get current players for spending calculation
    const { data: players } = await client.supabase
      .from('players')
      .select('player_value')
      .eq('team_id', team.id)
      .eq('status', 'active');

    // Calculate current spending
    const spending = calculateTeamSpending({
      players: players || [],
      rerolls: team.rerolls || 0,
      rerollCost: roster.rerollCost,
      assistantCoaches: team.assistant_coaches || 0,
      cheerleaders: team.cheerleaders || 0,
      hasApothecary: team.apothecary_hired || false,
      dedicatedFans: team.dedicated_fans || 1
    });

    const currentFans = team.dedicated_fans || 1;
    const totalFans = currentFans + count;

    // Validate max fans
    if (totalFans > MAX_DEDICATED_FANS) {
      return await interaction.editReply(
        `❌ Maximum ${MAX_DEDICATED_FANS} dedicated fans allowed, you would have ${totalFans}\n\n` +
        `You already have ${currentFans} fan${currentFans > 1 ? 's' : ''}.`
      );
    }

    const cost = count * DEDICATED_FAN_COST;

    // Validate treasury
    if (cost > spending.treasury) {
      return await interaction.editReply(
        `❌ Not enough gold!\n\n` +
        `💰 Cost: ${cost.toLocaleString()}\n` +
        `💰 Treasury: ${spending.treasury.toLocaleString()}\n` +
        `💰 Short by: ${(cost - spending.treasury).toLocaleString()}`
      );
    }

    const newTreasury = spending.treasury - cost;

    // Update team
    const { error: updateError } = await client.supabase
      .from('teams')
      .update({
        dedicated_fans: totalFans,
        treasury: newTreasury
      })
      .eq('id', team.id);

    if (updateError) {
      console.error('Error purchasing fans:', updateError);
      return await interaction.editReply('❌ Failed to purchase fans. Please try again.');
    }

    await interaction.editReply(
      `✅ **Dedicated Fans Purchased!**\n\n` +
      `👥 Purchased: ${count} fan${count > 1 ? 's' : ''}\n` +
      `👥 Total Dedicated Fans: ${totalFans} / ${MAX_DEDICATED_FANS}\n` +
      `💰 Cost: ${cost.toLocaleString()}\n` +
      `💰 New Treasury: ${newTreasury.toLocaleString()}\n\n` +
      `Use \`/my-roster\` to view your complete roster.`
    );

  } catch (error) {
    console.error('Error in buy-fans:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
