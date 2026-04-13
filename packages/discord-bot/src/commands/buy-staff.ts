import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import {
  getRosterForRace,
  validateStaffPurchase,
  calculateTeamSpending,
  ASSISTANT_COACH_COST,
  CHEERLEADER_COST,
  APOTHECARY_COST
} from '../utils/roster-validator.js';

export const data = new SlashCommandBuilder()
  .setName('buy-staff')
  .setDescription('Purchase team staff')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type of staff to hire')
      .setRequired(true)
      .addChoices(
        { name: 'Assistant Coach (10,000 gold)', value: 'assistant_coach' },
        { name: 'Cheerleader (10,000 gold)', value: 'cheerleader' },
        { name: 'Apothecary (50,000 gold)', value: 'apothecary' }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('count')
      .setDescription('Number to hire (default: 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(6)
  );

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const staffType = interaction.options.getString('type', true) as 'assistant_coach' | 'cheerleader' | 'apothecary';
  const count = interaction.options.getInteger('count') || 1;
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
          apothecary_hired
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
      dedicatedFans: 1
    });

    // Get current count for this staff type
    let currentCount = 0;
    if (staffType === 'assistant_coach') currentCount = team.assistant_coaches || 0;
    else if (staffType === 'cheerleader') currentCount = team.cheerleaders || 0;
    else if (staffType === 'apothecary') currentCount = team.apothecary_hired ? 1 : 0;

    // Apothecary can only buy 1
    if (staffType === 'apothecary' && count > 1) {
      return await interaction.editReply('❌ You can only hire 1 Apothecary!');
    }

    // Validate purchase
    const validation = validateStaffPurchase(
      staffType,
      currentCount,
      count,
      spending.treasury,
      roster.apothecary
    );

    if (!validation.valid) {
      return await interaction.editReply(`❌ ${validation.reason}`);
    }

    const cost = validation.cost!;
    const newCount = currentCount + count;
    const newTreasury = spending.treasury - cost;

    // Prepare update object
    const updateData: any = { treasury: newTreasury };
    if (staffType === 'assistant_coach') updateData.assistant_coaches = newCount;
    else if (staffType === 'cheerleader') updateData.cheerleaders = newCount;
    else if (staffType === 'apothecary') updateData.apothecary_hired = true;

    // Update team
    const { error: updateError } = await client.supabase
      .from('teams')
      .update(updateData)
      .eq('id', team.id);

    if (updateError) {
      console.error('Error purchasing staff:', updateError);
      return await interaction.editReply('❌ Failed to purchase staff. Please try again.');
    }

    // Format staff name for display
    let staffName = '';
    let emoji = '';
    let maxCount = 0;
    if (staffType === 'assistant_coach') {
      staffName = 'Assistant Coach';
      emoji = '👨‍🏫';
      maxCount = 6;
    } else if (staffType === 'cheerleader') {
      staffName = 'Cheerleader';
      emoji = '📣';
      maxCount = 6;
    } else {
      staffName = 'Apothecary';
      emoji = '⚕️';
      maxCount = 1;
    }

    await interaction.editReply(
      `✅ **Staff Hired!**\n\n` +
      `${emoji} Hired: ${count} ${staffName}${count > 1 ? 's' : ''}\n` +
      `${emoji} Total: ${newCount} / ${maxCount}\n` +
      `💰 Cost: ${cost.toLocaleString()}\n` +
      `💰 New Treasury: ${newTreasury.toLocaleString()}\n\n` +
      `Use \`/my-roster\` to view your complete roster.`
    );

  } catch (error) {
    console.error('Error in buy-staff:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
