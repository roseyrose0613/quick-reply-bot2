import 'dotenv/config';
import fs from 'fs';
import Fuse from 'fuse.js';
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  Routes,
  REST,
} from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const faqs = JSON.parse(fs.readFileSync('./faqs.json', 'utf8'));
const fuse = new Fuse(faqs, {
  includeScore: true,
  threshold: 0.4,
  keys: ['question', 'keywords', 'answer'],
});

const commands = [
  new SlashCommandBuilder()
    .setName('faq')
    .setDescription('搜索并快速引用常见问题答案')
    .addStringOption(opt =>
      opt.setName('q').setDescription('关键词').setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName('public').setDescription('是否公开发到频道')
    )
    .toJSON(),
  new ContextMenuCommandBuilder()
    .setName('引用回复')
    .setType(ApplicationCommandType.Message)
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message],
});

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'faq') {
    const q = interaction.options.getString('q');
    const makePublic = interaction.options.getBoolean('public') || false;
    const results = fuse.search(q, { limit: 1 });
    if (results.length === 0) {
      await interaction.reply({ content: `未找到与「${q}」相关的条目`, ephemeral: true });
      return;
    }
    const best = results[0].item;
    const embed = new EmbedBuilder()
      .setTitle(`🔎 FAQ：${best.question}`)
      .setDescription(best.answer)
      .addFields({ name: '来源', value: best.source || '—' })
      .setFooter({ text: `ID: ${best.id}` });

    await interaction.reply({ embeds: [embed], ephemeral: !makePublic });
  }

  if (interaction.isMessageContextMenuCommand() && interaction.commandName === '引用回复') {
    const msg = interaction.targetMessage;
    const quoted = `> ${msg.content || '(无文字)'}\n—— 引用自 [这条消息](${msg.url})`;
    await interaction.reply({ content: quoted, allowedMentions: { parse: [] } });
  }
});

client.login(TOKEN);
