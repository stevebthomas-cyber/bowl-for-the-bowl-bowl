import { Client, Events } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  console.log(`✅ Bot is online! Logged in as ${client.user?.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} server(s)`);

  // Test Supabase connection
  try {
    const { data, error } = await client.supabase
      .from('users')
      .select('count');

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
    } else {
      console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.error('❌ Supabase connection error:', err);
  }
}
