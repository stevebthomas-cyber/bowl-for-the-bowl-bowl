import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong! (Test command)');

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(client.ws.ping);

  await interaction.editReply(
    `🏓 Pong!\n` +
    `📡 Latency: ${latency}ms\n` +
    `💓 API Latency: ${apiLatency}ms`
  );
}
