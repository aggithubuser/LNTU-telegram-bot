import { Context, Markup, Telegraf } from "telegraf";
import { BACK_PREFIX, MAIN_KEYBOARD } from "./constants";
import mongoose from "mongoose";
import { Schedule, ScheduleModel } from "./db/models/schedule";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { folderContent } from "./driveApi";

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
  folderId: string | undefined;
}

// const keyboard = async (data = await scrapeLinks()) => {
//   let keyboardArr: any[] = [];
//   let links = await scrapeLinks();

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
    isBack = true;
    query = query.split(".")[0];
  }
  let match = await Schedule.findById(query);
  let mainKeyboard: InlineKeyboardButton[][] = [];
  if (match) {
    ctx ? (ctx.folderId = match.folderId) : undefined;
    mainKeyboard.push([
      Markup.button.callback("Повернутись", "schedule"),
      Markup.button.callback(
        "Назад",
        match.parent != null ? match.parent + BACK_PREFIX : "schedule"
      ),
    ]);
    items = await Schedule.find().where({ parent: match._id });
    if (items.length != 0) {
      items.forEach((i: ScheduleModel) => {
        mainKeyboard.push([
          i.isFile
            ? Markup.button.url(i.name as string, i.link)
            : Markup.button.callback(i.name as string, i._id),
        ]);
      });
    }

    if (ctx.folderId && items.length == 0) {
      let drive = await folderContent(ctx.folderId);
      for (const i of drive.files) {
        if (match) {
          console.log("adding to MONGOOSE");
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
      [Markup.button.callback(MAIN_KEYBOARD.NEWS_KEYBOARD, "news")],
      [Markup.button.callback(MAIN_KEYBOARD.SCHEDULE_KEYBOARD, "schedule")],
      [Markup.button.callback(MAIN_KEYBOARD.SCHEDULE_RINGS, "rings")],
      [Markup.button.callback(MAIN_KEYBOARD.SCHEDULE_WEEK, "week")],
    ])
  )
);

bot.action("schedule", async (ctx) => {
  let main = await Schedule.find().where({ parent: null });
  let mainKeyboard: InlineKeyboardButton[][] = [];
  main.forEach((i) => {
    return mainKeyboard.push([Markup.button.callback(i.name as string, i._id)]);
  });
  ctx.editMessageReplyMarkup({ inline_keyboard: mainKeyboard });
});

bot.action(new RegExp(/\w/), async (ctx) => {
  let items = await keyboard(ctx.update.callback_query.data as string, ctx);
  await ctx.editMessageReplyMarkup({ inline_keyboard: items });
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
