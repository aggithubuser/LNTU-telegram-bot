import { formatRelative, subDays } from "date-fns";
import { uk } from "date-fns/locale";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { Context, Markup, Telegraf } from "telegraf";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import {
  BACK_PREFIX,
  CALLBACK_KEYBOARD,
  HELPER_TEXT,
  MAIN_KEYBOARD,
  REMOTE_SCHEDULE_URL,
} from "./constants";
import { studyWeek } from "./date";
import { Schedule } from "./db/models/schedule";
import { folderContent } from "./driveApi";
import { log } from "./lib/log";
import { getNewsLinks } from "./scrape";

mongoose.connect(process.env.MONGO_REMOTE as string, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  autoIndex: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", async () => {
  console.log("GREAT");
});

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

const keyboard = async (query: any, ctx?: any) => {
  let items;
  // let items: ScheduleModel & mongoose.Document<any, {}>;
  if (query.includes(BACK_PREFIX)) {
    query = query.split(".")[0];
  }
  let match = await Schedule.findById(query);
  let mainKeyboard: InlineKeyboardButton[][] = [];
  if (match) {
    if (ctx) {
      ctx.currentFolder = match.name;
      ctx.folderId = match.folderId;
    }
    mainKeyboard.push([
      Markup.button.callback("У меню", CALLBACK_KEYBOARD.SCHEDULE),
      Markup.button.callback(
        "Назад",
        match.parent != null
          ? match.parent + BACK_PREFIX
          : CALLBACK_KEYBOARD.SCHEDULE
      ),
    ]);
    items = await Schedule.find().where({ parent: match._id });

    if (items.length != 0) {
      let detailString = "Деталі оновлень розкладу:\n\n";
      for (const i of items) {
        detailString = detailString.concat(
          `<b>${i.name}</b>\n(<i>оновлено ${formatRelative(
            subDays(i.serverUpdatedAt ? i.serverUpdatedAt : i.createdAt, 0),
            new Date(),
            {
              locale: uk,
            }
          )}</i>)\n\n`
        );
        // : "";
        mainKeyboard.push([
          i.isFile
            ? Markup.button.url(i.name as string, i.link as string)
            : Markup.button.callback(i.name as string, i._id),
        ]);
        ctx.filesInfo = detailString;
      }
    }

    if (ctx.folderId && items.length == 0) {
      let drive = await folderContent(ctx.folderId);
      for (const i of drive.files) {
        if (match) {
          let isFile = i.mimeType != "application/vnd.google-apps.folder";
          console.log(i);
          let item = await new Schedule({
            _id: new mongoose.Types.ObjectId(),
            name: i.name,
            link: i.webViewLink,
            isFile,
            folderId: i.id,
            parent: match._id,
            serverCreatedAt: i.createdTime,
            serverUpdatedAt: i.modifiedTime,
          }).save();
          mainKeyboard.push([
            isFile
              ? Markup.button.url(i.name as string, i.webViewLink)
              : Markup.button.callback(i.name as string, item._id),
          ]);
        }
      }
    }
  }
  return mainKeyboard;
};

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

bot.action(CALLBACK_KEYBOARD.SCHEDULE, async (ctx) => {
  let main = await Schedule.find().where({ parent: null });
  let mainKeyboard: InlineKeyboardButton[][] = [];
  main.forEach((i) => {
    return mainKeyboard.push([Markup.button.callback(i.name as string, i._id)]);
  });
  await ctx.editMessageText(HELPER_TEXT.SCHEDULE_PICKER);
  await ctx.editMessageReplyMarkup({ inline_keyboard: mainKeyboard });
  log(ctx, false);
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

bot.action(new RegExp(/\w/), async (ctx) => {
  // @ts-ignore
  let items = await keyboard(ctx.update.callback_query.data as any, ctx);
  await ctx.editMessageText(ctx.filesInfo ? ctx.filesInfo : ctx.currentFolder, {
    parse_mode: "HTML",
  });
  await ctx.editMessageReplyMarkup({ inline_keyboard: items });
  log(ctx, false);
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
