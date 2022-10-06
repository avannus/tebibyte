import { config, MongoClient } from "./deps.ts";

const client = new MongoClient();
await client.connect(config().MONGO_URL);
const db = client.database("TEBIBYTE");
const wlColl = db.collection("users");
const bColl = db.collection("bounties");

export async function userIsWhitelisted(userId: number) {
  const doc = await wlColl.findOne({ userId });
  const isDoc = !!doc;
  return isDoc;
}

export async function addUserToWhiteList(userId: number) {
  const existingDoc = await wlColl.findOne({ userId });
  const insertedDoc = existingDoc
    ? undefined
    : await wlColl.insertOne({ userId });
  return { existingDoc, insertedDoc };
}
