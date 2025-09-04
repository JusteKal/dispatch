// pages/api/auth/discord/callback.js
// Gère le callback OAuth2 Discord et vérifie l'appartenance à la guild

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    res.status(400).send('Code manquant');
    return;
  }

  // 1. Échanger le code contre un access_token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      scope: 'identify guilds'
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    res.status(401).send('Authentification Discord échouée');
    return;
  }

  // 2. Récupérer les guilds de l'utilisateur
  const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const guilds = await guildRes.json();
  const isMember = Array.isArray(guilds) && guilds.some(g => g.id === TARGET_GUILD_ID);

  if (isMember) {
    // Authentifié et membre du serveur
    // Récupérer les infos utilisateur Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const user = await userRes.json();

    // Récupérer le nickname sur le serveur
    let nickname = user.username;
    try {
      const memberRes = await fetch(`https://discord.com/api/guilds/${TARGET_GUILD_ID}/members/${user.id}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const member = await memberRes.json();
      if (member && member.nick) nickname = member.nick;
    } catch (e) {}

    // Stocker le nickname et l'avatar dans le cookie (simple, non sécurisé)
    const profile = encodeURIComponent(JSON.stringify({
      username: nickname,
      avatar: user.avatar,
      id: user.id
    }));
    res.setHeader('Set-Cookie', [
      `discord_auth=1; Path=/; SameSite=Lax`,
      `discord_profile=${profile}; Path=/; SameSite=Lax`
    ]);
    res.redirect('/');
    return;
  } else {
    // Non membre
  res.setHeader('Set-Cookie', `discord_auth=0; Path=/; SameSite=Lax`);
    res.status(403).send('Vous devez être membre du serveur Discord pour accéder à cette page.');
    return;
  }
}
