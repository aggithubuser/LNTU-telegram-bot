import { Schedule } from "../db/models/schedule";
import { getScheduleLinks } from "../scrape";
import mongoose from "mongoose";

// legacy using scraping

export const initialPolutationSchedule = async () => {
  let links = await getScheduleLinks();
  let parent;
  let schedule;
  for (const link of links) {
    parent = new Schedule({
      _id: new mongoose.Types.ObjectId(),
      name: link.name,
    }).save();
    console.log(link);
    if (link.data) {
      for (const data of link.data) {
        const parentId = await parent;
        console.log("data.link ", data.link);
        console.log("data.id ", data.id);
        new Schedule({
          _id: new mongoose.Types.ObjectId(),
          name: data.name,
          link: data.link,
          folderId: data.id,
          parent: parentId._id,
        }).save();
      }
    }
    //a
  }
};
