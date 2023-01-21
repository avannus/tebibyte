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
import { InputFile } from "https://deno.land/x/grammy@v1.11.1/types.deno.ts";
import { delay } from "https://deno.land/x/delay@v0.2.0/mod.ts";

type MyContext = Context & ConversationFlavor & { isAdmin: boolean };
type MyConversation = Conversation<MyContext>;

// HELPERS
// TODO MOVE

async function denoRun(
  cmd: string[] | string,
  stdout: Deno.RunOptions["stdout"] = "piped",
  stderr: Deno.RunOptions["stderr"] = "piped",
) {
  if (typeof cmd === "string") {
    cmd = cmd.split(" ");
  }

  const query = Deno.run({
    cmd,
    stdout,
    stderr,
  });
  console.log("here with cmd", cmd);
  const status = await query.status();
  const output = await query.output();
  const stderrOutput = await query.stderrOutput();
  const outputString = new TextDecoder().decode(output);
  const stderrOutputString = new TextDecoder().decode(stderrOutput);

  const result = {
    status,
    // output,
    // stderrOutput,
    outputString,
    stderrOutputString,
  };

  return result;
}

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
    callbackQuery.editMessageText(
      callbackQuery.msg?.text + "\n\nYou replied with " + userResponse,
    );
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

  // reply with sit-rep
  console.log(userLink);
  if (whiteListReturn.existingDoc) {
    ctx.reply(`User ${userLink} already whitelisted`, {parse_mode: "HTML"});
  } else {
    ctx.reply(`Success! Added user ${userLink}`, {parse_mode: "HTML"});
  }
  // todo add user to exercise group
}

const rules =
  "-Members must wager SOMETHING, usually money. Having anything to lose adds to the peer pressure\n" +
  "-Members must hit their self-defined goals on your self-defined interval\n" +
  "-After a member completes their first interval, they are open to collecting bounties\n" +
  "-Any member who fails to meet their goal will have to pay out every other eligible member\n" +
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

// /create(Bounty), conversation
bot.use(createConversation(createBounty));
bot.command(
  "create",
  async (ctx) => await ctx.conversation.enter("createBounty"),
);

bot.command("mk", async (ctx) => {
  console.log(JSON.stringify({ ctx }));
  if (!ctx.match) {
    ctx.reply("Please give me a text prompt after `/mk`, clickable ex: <code>/mk robot on a rock</code>\n(feel free to send this a few times to get diff results)\n\nEach command goes in a queue and takes about a minute.\n\nThis is very buggy right now so there's a good chance the bot won't reply correctly\n\nMy monitors literally don't work correctly rn because of this command lmao\n\nAlso this crashes the bot server a lot :^)", {parse_mode: "HTML"});
    return;
  }
  ctx.replyWithChatAction("typing");
  const steps = 200;
  // 'new_test_smile_happy_weird'__steps_2__scale_7.50__seed_12410494896098843756__n_1
  const message = ctx.match;
  const seed = Math.floor(Math.random() * 100000) + 1;
  const file_name = `/home/andrew/Projects/tebibyte/output/${
    message.replace(/ /g, "_")
  }__steps_${steps}__scale_7.50__seed_${seed}__n_1.png`;
  console.log(file_name);
  const build = await denoRun([
    "./build.sh",
    "run",
    "--W",
    "512",
    "--H",
    "512",
    "--half",
    "--attention-slicing",
    "--skip",
    "--prompt",
    "--seed",
    `${seed}`,
    "--ddim_steps",
    `${steps}`,
    `${message}`,
  ]);
  console.log(JSON.stringify({ build }));
  await delay(2000);
  const file: InputFile = new InputFile(file_name);
  await delay(2000);
  console.log("inputFile");
  console.log(file);
  console.log(JSON.stringify({ file }));
  try{
  await ctx.replyWithPhoto(file, {
    caption: `Seed: ${seed}`,
    reply_to_message_id: ctx.message?.message_id,
  });
  }catch(e){
    ctx.reply("File made, but failed to send, try again I guess.\n\nSometimes the same thing will work on the second or fifth try.\n\nMake sure the prompt doesn't have any weird characters and isn't too long (100 characters?) because I'm literally guessing the file name of the file an external program creates.\n\nThis will be fixed soon.");
    console.log(e);
  }
});

// /whitelist
bot.command("whitelist", async (ctx) => await addToWhitelist(ctx));

// all uncaught messages
bot.on(
  "message",
  (ctx) => ctx.reply("You sent a message not caught by middleware (aka no action found)"),
);

bot.catch((err) => {
  console.log("Oops", err);
});

const x = await denoRun("docker login");
console.log(x);
const y = await denoRun("./build.sh build");
console.log(y);
console.log("build done");

bot.start();
