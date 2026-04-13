import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register as a coach in the league');

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const discordId = interaction.user.id;
  const discordUsername = interaction.user.username;

  try {
    // Check if league exists
    const { data: league, error: leagueError } = await client.supabase
      .from('leagues')
      .select('id, name, season_status')
      .limit(1)
      .single();

    if (!league) {
      return await interaction.editReply({
        content: '❌ No league has been created yet.\n\nA commissioner needs to run `/create-league` first.'
      });
    }

    // Get or create user
    let userId: string;
    const { data: existingUser } = await client.supabase
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

    // Check if already registered as a coach
    const { data: existingRole } = await client.supabase
      .from('user_roles')
      .select('role')
      .eq('league_id', league.id)
      .eq('user_id', userId)
      .eq('role', 'coach')
      .single();

    if (existingRole) {
      return await interaction.editReply({
        content: `✅ You're already registered as a coach in **${league.name}**!\n\nUse \`/create-team\` to create your team.`
      });
    }

    // Check max coaches (from league config)
    const { data: existingCoaches, error: countError } = await client.supabase
      .from('user_roles')
      .select('id')
      .eq('league_id', league.id)
      .eq('role', 'coach');

    const maxCoaches = 8; // Default from rules_config
    if (existingCoaches && existingCoaches.length >= maxCoaches) {
      return await interaction.editReply({
        content: `❌ The league is full! Maximum ${maxCoaches} coaches allowed.`
      });
    }

    // Register as coach
    const { error: roleError } = await client.supabase
      .from('user_roles')
      .insert({
        league_id: league.id,
        user_id: userId,
        role: 'coach'
      });

    if (roleError) {
      console.error('Error registering coach:', roleError);
      return await interaction.editReply('❌ Failed to register. Please try again.');
    }

    await interaction.editReply({
      content: `✅ **Welcome to ${league.name}!**\n\n` +
        `You're now registered as a coach.\n\n` +
        `Next step: Use \`/create-team\` to build your team!`
    });

  } catch (error) {
    console.error('Error in register:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
