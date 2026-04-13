import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

// Load environment variables
dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
  process.exit(1);
}

const commands: any[] = [];

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load command files
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file =>
  file.endsWith('.js') || file.endsWith('.ts')
);

console.log('📝 Loading commands...');

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);

  try {
    const command = await import(filePath);

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`  ✅ Loaded: ${command.data.name}`);
    } else {
      console.warn(`  ⚠️  Skipped ${file}: missing "data" or "execute" property`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to load ${file}:`, error);
  }
}

// Construct REST module
const rest = new REST().setToken(DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands.`);

    let data: any;

    if (DISCORD_GUILD_ID) {
      // Guild-specific commands (faster, good for development)
      console.log(`📍 Deploying to guild: ${DISCORD_GUILD_ID}`);
      data = await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commands }
      );
    } else {
      // Global commands (takes up to 1 hour to propagate)
      console.log('🌍 Deploying globally (may take up to 1 hour)');
      data = await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands }
      );
    }

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
