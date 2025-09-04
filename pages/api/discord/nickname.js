const BOT_TOKEN = process.env.BOT_TOKEN; // Remplace par le token de ton bot
const GUILD_ID = process.env.TARGET_GUILD_ID;

export default async function handler(req, res) {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId manquant' });

  const discordRes = await fetch(
    `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`,
    { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  );
  const member = await discordRes.json();
  const nickname = member.nick || (member.user && member.user.username) || null;
  res.status(200).json({ nickname });
}
