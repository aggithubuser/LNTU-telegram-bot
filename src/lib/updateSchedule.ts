import { Schedule } from "../db/models/schedule";
import { folderContent } from "../driveApi";
import mongoose from "mongoose";

// legacy using scraping

const populate = async (id: string, parent: string) => {
  let drive = await folderContent(id);
  console.log(parent);
  console.log(drive);
  for (const i of drive.files) {
    let isFile = i.mimeType != "application/vnd.google-apps.folder";
    await new Schedule({
      _id: new mongoose.Types.ObjectId(),
      name: i.name,
      link: i.webViewLink,
      isFile,
      folderId: i.id,
      parent: parent,
      serverCreatedAt: i.createdTime,
      serverUpdatedAt: i.modifiedTime,
    }).save();
  }
};

export const updateSchedule = async () => {
  let folders = await Schedule.find({ parent: { $ne: null } });
  let i = 0;
  for (const folder of folders) {
    let driveFolders = await folderContent(folder.folderId);
    console.log(folder.folderId);
    console.log(folder.parent);
    console.log(driveFolders);
    i += 1;
    if (driveFolders) {
      for (const d of driveFolders.files) {
        let isFile = d.mimeType != "application/vnd.google-apps.folder";

        let parentFolder = await new Schedule({
          _id: new mongoose.Types.ObjectId(),
          name: d.name,
          link: d.webViewLink,
          isFile,
          folderId: d.id,
          parent: folder._id,
          serverCreatedAt: d.createdTime,
          serverUpdatedAt: d.modifiedTime,
        }).save();
        if (isFile === false) {
          populate(d.id, parentFolder._id);
        } else {
          await new Schedule({
            _id: new mongoose.Types.ObjectId(),
            name: d.name,
            link: d.webViewLink,
            isFile,
            folderId: d.id,
            parent: parentFolder._id,
            serverCreatedAt: d.createdTime,
            serverUpdatedAt: d.modifiedTime,
          }).save();
        }
      }
    }
  }
};
