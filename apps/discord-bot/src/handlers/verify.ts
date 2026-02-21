import type { ChatInputCommandInteraction } from 'discord.js'
import { createVerifySession } from '../api-client.js'
import { API_BASE_URL, DISCORD_BOT_API_SECRET, buildVerifyUrl } from '../config.js'

export async function handleVerify(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!DISCORD_BOT_API_SECRET) {
    await interaction.reply({ content: 'Verification is not configured.', ephemeral: true })
    return
  }
  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true })
    return
  }
  await interaction.deferReply({ ephemeral: true })
  try {
    const data = await createVerifySession(
      API_BASE_URL,
      DISCORD_BOT_API_SECRET,
      guildId,
      interaction.user.id
    )
    const url = buildVerifyUrl(data.tenant_slug, data.verify_token)
    await interaction.editReply({
      content: `Open this link to link your wallet to your Discord account (expires in 15 minutes):\n${url}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Guild not linked')) {
      await interaction.editReply({ content: 'This server is not connected to a community. Ask an admin to connect it first.' })
    } else {
      await interaction.editReply({ content: 'Something went wrong. Try again later.' })
    }
  }
}
