const { Telegraf } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const prisma = new PrismaClient();

bot.start((ctx) => {
  ctx.reply('Welcome to the Telegram Mini App!');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username;

  // Store user in MongoDB using Prisma
  try {
    let user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
        },
      });
      ctx.reply('You have been registered!');
    } else {
      ctx.reply('Welcome back!');
    }
  } catch (error) {
    console.error('Error saving user:', error);
    ctx.reply('Something went wrong!');
  }
});

bot.launch().then(() => {
  console.log('Bot is running...');
});
