import { MyContext } from "src";

export const log = (ctx: MyContext, text = true) => {
  ctx.telegram.sendMessage(
    process.env.CHAT_ID as string,
    `${ctx.from?.id}\n${ctx.from?.first_name}\n${ctx.from?.last_name}\n${
      ctx.from?.username
      // @ts-ignore
    }\n${text ? ctx.message.text : ctx.callbackQuery?.message.text}`
  );
};
