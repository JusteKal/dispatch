# Dispatch LSMS

Système de gestion des médecins pour Discord, développé avec Next.js et Node.js.

## Fonctionnalités principales
- Authentification sécurisée via Discord OAuth2
- Accès réservé aux membres d’un serveur Discord spécifique
- Affichage du profil Discord (pseudo, avatar, nickname serveur)
- Gestion des médecins, spécialités et affectations (repos, intervention, absent)
- Panel d’administration et affichage dynamique des membres

## Structure du projet
```
dispatch/
├── pages/
│   ├── index.js                # Page principale, affichage du panel et profil Discord
│   ├── api/
│   │   ├── auth/discord.js     # Route d’initiation OAuth2
│   │   ├── auth/discord/callback.js # Callback OAuth2, vérification et session
│   │   ├── discord/nickname.js # API pour récupérer le nickname via le bot
├── server/
│   ├── data.json               # Données des médecins et affectations (non versionné)
├── styles/                     # Fichiers CSS
├── types/                      # Types TypeScript
├── utils/
│   ├── cookies.js              # Utilitaires pour la gestion des cookies
├── .env                        # Variables d’environnement (Discord, bot, etc.)
├── .gitignore                  # Fichiers ignorés par git
├── package.json                # Dépendances et scripts
```

## Configuration
1. Crée un fichier `.env` à la racine :
   ```env
   CLIENT_ID=ton_client_id
   CLIENT_SECRET=ton_client_secret
   REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
   BOT_TOKEN=ton_bot_token
   TARGET_GUILD_ID=ton_guild_id
   ```
2. Installe les dépendances :
   ```bash
   npm install
   ```
3. Lance le serveur de développement :
   ```bash
   npm run dev
   ```

## Sécurité
- Les accès au panel sont vérifiés côté serveur : seuls les membres du Discord cible peuvent se connecter.
- Les données sensibles (`data.json`, `.env`) sont ignorées par git.

## Auteur
JusteKal

---
Pour toute question ou amélioration, ouvre une issue ou contacte le mainteneur sur Discord.
