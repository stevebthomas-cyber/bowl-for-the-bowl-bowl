import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('my-team')
  .setDescription('View your team information');

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
      return await interaction.editReply('❌ You need to `/register` as a coach first!');
    }

    // Get team via ownership
    const { data: ownership } = await client.supabase
      .from('team_ownership')
      .select(`
        role,
        team:teams (
          id,
          name,
          race,
          tier,
          division,
          treasury,
          team_value,
          dedicated_fans,
          min_dedicated_fans,
          rerolls,
          wins,
          losses,
          ties,
          league_points,
          total_sobs,
          active
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (!ownership || !ownership.team) {
      return await interaction.editReply({
        content: '❌ You don\'t own a team yet!\n\nUse `/create-team` to create one.'
      });
    }

    const team = ownership.team as any;

    // Get player count
    const { count: playerCount } = await client.supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('status', 'active');

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`🏈 ${team.name}`)
      .setDescription(`${team.race} • Tier ${team.tier}${team.division ? ` • Division ${team.division}` : ''}`)
      .addFields(
        { name: '📊 Record', value: `${team.wins}W - ${team.losses}L - ${team.ties}T`, inline: true },
        { name: '🎯 League Points', value: `${team.league_points}`, inline: true },
        { name: '⭐ SOBs', value: `${team.total_sobs}`, inline: true },
        { name: '💰 Treasury', value: `${team.treasury.toLocaleString()} gold`, inline: true },
        { name: '📈 Team Value', value: `${team.team_value.toLocaleString()}`, inline: true },
        { name: '👥 Fans', value: `${team.dedicated_fans} (min: ${team.min_dedicated_fans})`, inline: true },
        { name: '🔄 Rerolls', value: `${team.rerolls}`, inline: true },
        { name: '⚔️ Players', value: `${playerCount || 0} active`, inline: true },
        { name: '✅ Status', value: team.active ? 'Active' : 'Inactive', inline: true }
      )
      .setFooter({ text: `Your Role: ${ownership.role}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in my-team:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
