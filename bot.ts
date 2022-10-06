import { Bot } from "./deps.ts";
import { config } from "./deps.ts";

const bot = new Bot(config().BOT_TOKEN);

bot.on("message", (ctx) => ctx.reply("hi there"));

bot.start();
