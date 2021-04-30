import { Context, Markup, Telegraf } from "telegraf";
import { BACK_PREFIX, CALLBACK_KEYBOARD, MAIN_KEYBOARD } from "./constants";
import mongoose from "mongoose";
import { Schedule } from "./db/models/schedule";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { folderContent } from "./driveApi";
import { getNewsLinks } from "./scrape";
import { formatRelative, subDays } from "date-fns";
import { uk } from "date-fns/locale";
import { studyWeek } from "./date";

mongoose.connect(process.env.MONGO as string, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  autoIndex: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("GREAT");
});

// const schedule = new Schedule({
//   _id: new mongoose.Types.ObjectId(),
//   name: "name",
//   link: "lin",
//   folderId: "folderId",
// }).save();

const token = process.env.BOT_TOKEN;
if (token === undefined) {
  throw new Error("BOT_TOKEN must be provided!");
}

interface MyContext extends Context {
  // will be available under `ctx.myContextProp`
  myContextProp: string;
  prop: any;
  currentFolder: string;
  filesInfo: string;
  folderId: string | undefined;
  newsDates: string | undefined;
}

// const keyboard = async (data = await getScheduleLinks()) => {
//   let keyboardArr: any[] = [];
//   let links = await getScheduleLinks();

// links.map(async (item, i) => {
//   console.log(item.name);
//   console.log(item.data);
//   // const parent = new Schedule({
//   //   _id: new mongoose.Types.ObjectId(),
//   //   name: item.name,
//   // }).save();

//   // const parentId = await parent;
//   // item.data.map((data) => {
//   //   new Schedule({
//   //     _id: new mongoose.Types.ObjectId(),
//   //     name: data.name,
//   //     link: data.link,
//   //     folderId: data.id,
//   //     parent: parentId.name,
//   //   }).save();
//   // });

//     keyboardArr.push([Markup.button.callback(item.name, `ind:${i}`)]);
//   });
//   return data;
// };

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
      Markup.button.callback("Повернутись", "schedule"),
      Markup.button.callback(
        "Назад",
        match.parent != null ? match.parent + BACK_PREFIX : "schedule"
      ),
    ]);
    items = await Schedule.find().where({ parent: match._id });

    if (items.length != 0) {
      let detailString = "Деталі оновлень розкладу:\n\n";
      for (const i of items) {
        i.isFile
          ? (detailString = detailString.concat(
              `${i.name}\n(оновлено ${formatRelative(
                subDays(i.createdAt, 3),
                new Date(),
                {
                  locale: uk,
                }
              )})\n\n`
            ))
          : "";
        mainKeyboard.push([
          i.isFile
            ? Markup.button.url(i.name as string, i.link)
            : Markup.button.callback(i.name as string, i._id),
        ]);
        ctx.filesInfo = detailString;
      }
    }

    if (ctx.folderId && items.length == 0) {
      let drive = await folderContent(ctx.folderId);
      for (const i of drive.files) {
        if (match) {
          let item = await new Schedule({
            _id: new mongoose.Types.ObjectId(),
            name: i.name,
            link: i.webViewLink,
            isFile: i.mimeType != "application/vnd.google-apps.folder",
            folderId: i.id,
            parent: match._id,
          }).save();
          mainKeyboard.push([
            i.isFile
              ? Markup.button.url(i.name as string, i.link)
              : Markup.button.callback(i.name as string, item._id),
          ]);
        }
      }
    }
  }
  return mainKeyboard;
};

const bot = new Telegraf<MyContext>(token);

bot.command("start", (ctx) =>
  ctx.reply(
    MAIN_KEYBOARD.PICK_MENU,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          MAIN_KEYBOARD.NEWS_KEYBOARD,
          CALLBACK_KEYBOARD.NEWS
        ),
      ],
      [
        Markup.button.callback(
          MAIN_KEYBOARD.SCHEDULE_KEYBOARD,
          CALLBACK_KEYBOARD.SCHEDULE
        ),
      ],
      [
        Markup.button.callback(
          MAIN_KEYBOARD.SCHEDULE_WEEK,
          CALLBACK_KEYBOARD.WEEK
        ),
      ],
    ])
  )
);

bot.action(CALLBACK_KEYBOARD.NEWS, async (ctx) => {
  let keyboard: InlineKeyboardButton[][] = [];
  let news = await getNewsLinks();

  news.map((i) => {
    keyboard.push([Markup.button.url(i.title, i.link)]);
  });
  await ctx.editMessageText(
    `Новини від  ${news[news.length - 1].date}  по  ${news[0].date}`
  );
  await ctx.editMessageReplyMarkup({ inline_keyboard: keyboard });
});

bot.action(CALLBACK_KEYBOARD.SCHEDULE, async (ctx) => {
  let main = await Schedule.find().where({ parent: null });
  let mainKeyboard: InlineKeyboardButton[][] = [];
  await ctx.editMessageText(MAIN_KEYBOARD.PICK_MENU);
  main.forEach((i) => {
    return mainKeyboard.push([Markup.button.callback(i.name as string, i._id)]);
  });
  ctx.editMessageReplyMarkup({ inline_keyboard: mainKeyboard });
});

bot.action(CALLBACK_KEYBOARD.WEEK, async (ctx) => {
  ctx.reply(studyWeek(), { parse_mode: "HTML" });
});

bot.action(new RegExp(/\w/), async (ctx) => {
  let items = await keyboard(ctx.update.callback_query.data as string, ctx);
  await ctx.editMessageText(ctx.filesInfo ? ctx.filesInfo : ctx.currentFolder);
  await ctx.editMessageReplyMarkup({ inline_keyboard: items });
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
