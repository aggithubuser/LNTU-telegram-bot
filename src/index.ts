import { formatRelative, subDays } from "date-fns";
import { uk } from "date-fns/locale";
import express from "express";
import mongoose from "mongoose";
import { Context, Markup, Telegraf } from "telegraf";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import {
  BACK_PREFIX,
  CALLBACK_KEYBOARD,
  HELPER_TEXT,
  MAIN_KEYBOARD,
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
  // initialPolutationSchedule();
  // updateScheduleFromDrive(process.env.DRIVE_ID);
  // updateSchedule(process.env.DRIVE_ID);
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
      Markup.button.text(MAIN_KEYBOARD.SCHEDULE_KEYBOARD),
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
  let main = await Schedule.find().where({ parent: null });
  let mainKeyboard: InlineKeyboardButton[][] = [];
  // await ctx.reply(MAIN_KEYBOARD.PICK_MENU);
  main.forEach((i) => {
    return mainKeyboard.push([Markup.button.callback(i.name as string, i._id)]);
  });
  await ctx.reply(MAIN_KEYBOARD.PICK_MENU, Markup.inlineKeyboard(mainKeyboard));
  // await ctx.editMessageReplyMarkup({ inline_keyboard: mainKeyboard });
  log(ctx, false);
});

bot.hears(MAIN_KEYBOARD.SCHEDULE_WEEK, async (ctx) => {
  ctx.reply(studyWeek(), { parse_mode: "HTML" });
  log(ctx);
});

bot.action(new RegExp(/\w/), async (ctx) => {
  let items = await keyboard(ctx.update.callback_query.data as string, ctx);
  await ctx.editMessageText(ctx.filesInfo ? ctx.filesInfo : ctx.currentFolder, {
    parse_mode: "HTML",
  });
  await ctx.editMessageReplyMarkup({ inline_keyboard: items });
  log(ctx, false);
});

bot.telegram.setWebhook(`${process.env.WEB}/${bot.secretPathComponent()}`);

const app = express();
app.get("/", (req: Request, res: Response) => res.send("Hello World!"));
// Set the bot API endpoint
app.use(bot.webhookCallback(process.env.WEB));
app.listen(process.env.PORT, () => {
  console.log("Example app listening on port 3000!");
});

// bot.launch();

// process.once("SIGINT", () => bot.stop("SIGINT"));
// process.once("SIGTERM", () => bot.stop("SIGTERM"));
