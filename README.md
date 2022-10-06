# tebibyte
Telegram Exercise Bully Intelligently Berating You To Exercise

tebibyte is a Deno runtime, TypeScript Telegram bot that utilizes MongoDB.

General usecase:
1. Create a groupchat and add tebibyte
2. Add necessary config vars to .env
3. Add users with `/register`
    1. They should recieve this message on any interaction with the bot
4. Users can create a bounty with `/create`
    1. Users will need to follow instructions on creating an account
5. All eligible members will need to hit their bounties or forfeit their wager to all other eligible members of the group

Users can see the rules with `/rules`

Users can withdraw (effective the end of the current bounty) with `/withdraw #bounty`

tebibyte will give a report after every interval (daily, monthly)

tebibyte will alert users who they have to pay, and how much.
