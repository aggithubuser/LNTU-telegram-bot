import { Schedule } from "../db/models/schedule";
import { Folder, folderContent } from "../driveApi";
import mongoose from "mongoose";

export const queue = async (list: Folder) => {
  let stack: string[] = [];
  list.files.map((i) => stack.push(i.id));
  return stack;
};

export const getFolder = async (q: string[]): Promise<boolean> => {
  if (q.length != 0) {
    let latest = q[q.length - 1];
    let res = await folderContent(latest);
    q.pop();
    q = [...q, ...(await queue(res))];
    await mapContentToCollection(res);
    return getFolder(q);
  }
  return true;
};

const mapContentToCollection = async (content: Folder) => {
  for (const i of content.files) {
    let exists = await Schedule.findOne({ folderId: i.id });
    let parentExists = await Schedule.findOne({ folderId: i.parents[0] });
    if (exists != null) {
      console.log("Already exists", i.name, exists.name);
      exists.updatedAt = new Date();
      await exists.save();
    } else {
      new Schedule({
        _id: new mongoose.Types.ObjectId(),
        name: i.name,
        link: i.webViewLink,
        isFile: i.mimeType != "application/vnd.google-apps.folder",
        folderId: i.id,
        parent:
          i.parents[0] === (process.env.DRIVE_ID as string)
            ? parentExists?._id
            : null,
        serverCreatedAt: i.createdTime,
        serverUpdatedAt: i.modifiedTime,
      }).save();
    }
  }
};

export const updateScheduleFromDrive = async (id: string) => {
  const content = await folderContent(id);
  await mapContentToCollection(content);
  console.log("DONE 1");
  await getFolder(await queue(content));
  console.log("DONE 2");
};
