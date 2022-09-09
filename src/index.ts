import express, { Request, Response } from "express";
import { Context, Markup, Telegraf } from "telegraf";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import {
  HELPER_TEXT,
  MAIN_KEYBOARD,
  REMOTE_SCHEDULE_URL,
} from "./constants";
import { studyWeek } from "./date";
import { log } from "./lib/log";
import { getNewsLinks } from "./scrape";

const token = process.env.BOT_TOKEN;
if (token === undefined) {
  throw new Error("BOT_TOKEN must be provided!");
}

export interface MyContext extends Context {
  // will be available under `ctx.myContextProp`
  myContextProp: string;
  prop: any;
  currentFolder: string;
  filesInfo: string;
  folderId: string | undefined;
  newsDates: string | undefined;
}

const bot = new Telegraf<MyContext>(token);

bot.command("start", (ctx) => {
  ctx.reply(
    `Привіт, ${ctx.message.from.first_name}!`,
    Markup.keyboard([
      Markup.button.text(MAIN_KEYBOARD.NEWS_KEYBOARD),
      Markup.button.webApp(MAIN_KEYBOARD.SCHEDULE_KEYBOARD, REMOTE_SCHEDULE_URL),
      Markup.button.text(MAIN_KEYBOARD.SCHEDULE_WEEK),
    ])
  );
  log(ctx);
});
bot.command("help", (ctx) => {
  ctx.reply(HELPER_TEXT.HELP);
});

bot.hears(MAIN_KEYBOARD.NEWS_KEYBOARD, async (ctx) => {
  let keyboard: InlineKeyboardButton[][] = [];
  let news = await getNewsLinks();

  news.map((i) => {
    keyboard.push([Markup.button.url(i.title, i.link)]);
  });

  await ctx.reply(
    `Новини від  ${news[news.length - 1].date}  по  ${news[0].date}`,
    Markup.inlineKeyboard(keyboard)
  );
  log(ctx);
});

bot.hears(MAIN_KEYBOARD.SCHEDULE_KEYBOARD, async (ctx) => {
  await ctx.reply(`Тепер розклад доступний по посиланню`, Markup.inlineKeyboard(
    [Markup.button.webApp("Розклад", REMOTE_SCHEDULE_URL)]
  ));
  log(ctx, false);
});

bot.hears(MAIN_KEYBOARD.SCHEDULE_WEEK, async (ctx) => {
  ctx.reply(studyWeek(), { parse_mode: "HTML" });
  log(ctx);
});

bot.hears(new RegExp(/./), async (ctx) => {
  ctx.reply(`Вибачте, але ми не розпізнали вашого запиту\nСпробуйте скористатись клавіатурою або командою \"\\start"`,
  Markup.inlineKeyboard([
    Markup.button.webApp(MAIN_KEYBOARD.SCHEDULE_KEYBOARD, REMOTE_SCHEDULE_URL),
  ]));
  log(ctx, false);
});

if (process.env.WEB) {
  bot.telegram.setWebhook(`${process.env.WEB}/${process.env.BOT_TOKEN}`);

  const app = express();
  app.get("/", (_req: Request, res: Response) => res.send("Hello World!"));
  // Set the bot API endpoint
  app.use(bot.webhookCallback(`/${process.env.BOT_TOKEN}`));
  app.listen(process.env.PORT, () => {
    console.log(`Example app listening on port ${process.env.PORT}!`);
  });
} else {
  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
