import 'dotenv/config'
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js'
import { registerCommands } from './commands.js'
import { handleVerify } from './handlers/verify.js'
import { runRoleSyncForGuild, syncLinkedGuild } from './handlers/sync.js'
import { DISCORD_BOT_TOKEN, DISCORD_BOT_API_SECRET, ROLE_SYNC_INTERVAL_MS } from './config.js'

async function main(): Promise<void> {
  if (!DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is required')
    process.exit(1)
  }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  })
  client.once(Events.ClientReady, async () => {
    await registerCommands(client)
    if (DISCORD_BOT_API_SECRET) {
      await new Promise((r) => setTimeout(r, 5000))
      for (const [, guild] of client.guilds.cache) {
        try {
          await syncLinkedGuild(guild)
        } catch (err) {
          console.error(`Sync failed for guild ${guild.name}:`, err)
        }
      }
      setInterval(() => {
        if (!DISCORD_BOT_API_SECRET) return
        for (const [, guild] of client.guilds.cache) {
          runRoleSyncForGuild(guild).catch((err) =>
            console.error(`Role sync interval error ${guild.name}:`, err)
          )
        }
      }, ROLE_SYNC_INTERVAL_MS)
    }
  })
  client.on('guildCreate', async (guild) => {
    if (!DISCORD_BOT_API_SECRET) return
    try {
      await syncLinkedGuild(guild)
    } catch (err) {
      console.error(`Sync failed for guild ${guild.name}:`, err)
    }
  })
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName === 'verify') {
      await handleVerify(interaction)
    }
  })
  await client.login(DISCORD_BOT_TOKEN)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
