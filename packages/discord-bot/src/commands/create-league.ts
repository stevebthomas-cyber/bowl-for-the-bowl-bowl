import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('create-league')
  .setDescription('Create a new Blood Bowl league (First-time setup)')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Name of your league')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const leagueName = interaction.options.getString('name', true);
  const discordId = interaction.user.id;
  const discordUsername = interaction.user.username;

  try {
    // Check if a league already exists for this guild
    const { data: existingLeague, error: checkError } = await client.supabase
      .from('leagues')
      .select('id, name')
      .limit(1)
      .single();

    if (existingLeague) {
      return await interaction.editReply({
        content: `❌ A league already exists: **${existingLeague.name}**\n\nOnly one league per Discord server is supported in Phase 1.`
      });
    }

    // Get or create user
    let userId: string;
    const { data: existingUser, error: userCheckError } = await client.supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await client.supabase
        .from('users')
        .insert({
          discord_id: discordId,
          discord_username: discordUsername,
          display_name: interaction.user.displayName || discordUsername
        })
        .select('id')
        .single();

      if (createUserError || !newUser) {
        console.error('Error creating user:', createUserError);
        return await interaction.editReply('❌ Failed to create user account. Please try again.');
      }

      userId = newUser.id;
    }

    // Create league with default config
    const { data: league, error: leagueError } = await client.supabase
      .from('leagues')
      .insert({
        name: leagueName,
        commissioner_id: userId,
        season_number: 1,
        season_status: 'setup',
        rules_config: {
          max_teams: 8,
          min_teams: 4,
          divisions: 2,
          games_per_season: 10,
          attendance_threshold: 0.20,
          scoring: { win: 3, tie: 1, loss: 0 },
          sob_formula: 'log(tier) + 2 * (points / 10)',
          draft_picks: {
            '1': { spp: 28, dedicated_fans: 1 },
            '2': { spp: 20 },
            '3': { spp: 16 }
          }
        }
      })
      .select('id, name')
      .single();

    if (leagueError || !league) {
      console.error('Error creating league:', leagueError);
      return await interaction.editReply('❌ Failed to create league. Please try again.');
    }

    // Grant commissioner role
    const { error: roleError } = await client.supabase
      .from('user_roles')
      .insert({
        league_id: league.id,
        user_id: userId,
        role: 'commissioner',
        granted_by: userId
      });

    if (roleError) {
      console.error('Error granting commissioner role:', roleError);
      // League exists but role failed - still a partial success
    }

    // Create default visitor team
    const { error: visitorError } = await client.supabase
      .from('visitor_teams')
      .insert({
        league_id: league.id,
        roster_config: {
          race: 'Human',
          tier: 2,
          players: [],
          rerolls: 3,
          treasury: 0
        }
      });

    if (visitorError) {
      console.error('Error creating visitor team:', visitorError);
    }

    await interaction.editReply({
      content: `✅ **League Created!**\n\n` +
        `🏆 **${league.name}**\n` +
        `👑 Commissioner: ${interaction.user}\n` +
        `📊 Season: 1 (Setup)\n\n` +
        `Next steps:\n` +
        `• Coaches can now use \`/register\` to join\n` +
        `• Once registered, coaches use \`/create-team\` to build their teams\n` +
        `• When ready, you'll create the schedule and open the season`
    });

  } catch (error) {
    console.error('Error in create-league:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
