import {
  Bot,
  config,
  Context,
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
  InlineKeyboard,
  NextFunction,
  session,
} from "./deps.ts";
import { addUserToWhiteList, userIsWhitelisted } from "./db.ts";

type MyContext = Context & ConversationFlavor & { isAdmin: boolean };
type MyConversation = Conversation<MyContext>;

// HELPERS
// TODO MOVE

async function getIsAdmin(ctx: MyContext, next: NextFunction) {
  const userId = ctx.from?.id;
  ctx.isAdmin = userId?.toString() === config().ADMIN;
  await next();
}

async function whiteListCheck(
  ctx: MyContext,
  next: NextFunction,
): Promise<void> {
  const userId = ctx.from?.id;
  if (
    (
      !userId ||
      !(await userIsWhitelisted(ctx.from?.id))
    ) &&
    !ctx.isAdmin
  ) {
    ctx.reply(
      "Tap the text below to copy, and send it to the bot owner to be whitelisted.\n\n" +
        `<code>/whitelist ${userId}</code>`,
      { parse_mode: "HTML" },
    );
    return; // note, no next here. The bot does no further checks.
  }
  await next();
}

function userLinkFromId(userId: number | string, linkText?: string) {
  return `<a href="tg://user?id=${userId}">${linkText || userId}</a>`;
}

async function createBounty(conversation: MyConversation, ctx: Context) {
  await ctx.reply(
    "So you want to create a bounty, huh? Here are the rules:\n" +
      rules +
      "So, are you in?",
    {
      reply_markup: new InlineKeyboard()
        .text("YES")
        .text("NO"),
    },
  );
  // check for confirmation
  {
    let callbackQuery; // callback query 1
    let userResponse; // user response 1
    do {
      callbackQuery = await conversation.waitFor("callback_query:data");
      userResponse = callbackQuery.callbackQuery.data;
    } while (!(userResponse === "YES" || userResponse === "NO")); // todo test if this is possibly false
    callbackQuery.editMessageText(callbackQuery.msg?.text + "\n\nYou replied with " + userResponse);
    callbackQuery.editMessageReplyMarkup();
  }
}

async function addToWhitelist(ctx: MyContext) {
  if (!ctx.isAdmin) {
    console.log("Only the admin can whitelist users");
    return;
  }
  if (!ctx.match) {
    ctx.reply("Please include a userId as an argument");
    return;
  }
  const userId = Number(ctx.match);
  if (!userId || isNaN(userId)) {
    ctx.reply(
      `Problem with arg: userId should be parsable number ${{ userId }}`,
    );
    return;
  }

  const userLink = userLinkFromId(userId);
  const whiteListReturn = await addUserToWhiteList(userId);

  // reply with sitrep
  if (whiteListReturn.existingDoc) {
    ctx.reply(`User ${userLink} already whitelisted`, { parse_mode: "HTML" });
  } else {
    ctx.reply(`Success! Added user ${userLink}`, { parse_mode: "HTML" });
  }
  // todo add user to exercise group
}

const rules =
  "-Members must wager SOMETHING, usually money. Having anything to lose adds to the peer pressure\n" +
  "-Members must hit their self-defined goals on your self-defined interval\n" +
  "-After a member completes their first interval, they are open to collecting bounties\n" +
  "-Any member who fails to meet their goal will have to pay out every other eligable member\n" +
  "-Members can cancel their goals, but they will have to finish the current interval (or pay out)\n" +
  "-Members must acknowledge receipt of wager when paid out.\n" +
  "-Members can request for an exception, but other members must agree\n\n";

// BOT CONSTRUCTION
const bot = new Bot<MyContext>(config().BOT_TOKEN);

// Install the session plugin for conversations.
bot.use(session({
  initial() {
    // return empty object for now
    return {};
  },
}));
bot.use(conversations());

// add isAdmin to ctx
bot.use(getIsAdmin);
// add whiteListCheck to middleware
bot.use(whiteListCheck);

// /create(Bounty), coversation
bot.use(createConversation(createBounty));
bot.command(
  "create",
  async (ctx) => await ctx.conversation.enter("createBounty"),
);

// /whitelist
bot.command("whitelist", async (ctx) => await addToWhitelist(ctx));

// all uncaught messages
bot.on(
  "message",
  (ctx) => ctx.reply("You sent a message not caught by middleware"),
);

bot.start();
