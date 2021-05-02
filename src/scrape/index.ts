import cheerio from "cheerio";
import fetch from "node-fetch";
import { MAIN_URL, NEWS_URL, SCHEDULE_URL } from "../constants";

interface ScheduleDataRecord {
  name: string;
  link?: string;
  id?: string;
}

export interface ScheduleRecord {
  name: string;
  data?: ScheduleDataRecord[];
}

export interface NewsRecord {
  date: string;
  title: string;
  link: string;
}

export const getScheduleLinks = async (): Promise<ScheduleRecord[]> => {
  let scheduleData: ScheduleRecord[] = [];

  const response = await fetch(SCHEDULE_URL);
  const $ = cheerio.load(await response.text());

  $(".MsoNormal span").each((i, el) => {
    let text = $(el).text();
    let href = $(el).children().attr("href");
    let linksArr: ScheduleDataRecord[] = [];
    // let re = /(\w*)\?/;
    let reDash = /([\w,-]*)\?/;
    let reId = /id=(\w+)/;
    if (text.toLowerCase().includes("факультет")) {
      let elFirstChild = $(".MsoNormal span").eq(i + 1);
      let elSecondChild = $(".MsoNormal span").eq(i + 2);

      linksArr.push(
        {
          name: elFirstChild.text(),
          // @ts-ignore
          id: elFirstChild.children("a").attr("href")?.match(reDash)[1],
          link: elFirstChild.children("a").attr("href"),
        },
        {
          name: elSecondChild.text(),
          // @ts-ignore
          id: elSecondChild.children("a").attr("href")?.match(reDash)[1],
          link: elSecondChild.children("a").attr("href"),
        }
      );
      scheduleData.push({ name: text, data: linksArr });
    } else if (text.toLowerCase().includes("відділ")) {
      // @ts-ignore
      linksArr.push({ name: text, id: href?.match(reId)[1], link: href });
      scheduleData.push({ name: text, data: linksArr });
    }
  });
  return scheduleData;
};

export const getNewsLinks = async (
  url: string = NEWS_URL
): Promise<NewsRecord[]> => {
  const response = await fetch(url);
  const $ = cheerio.load(await response.text());
  let newsArr: NewsRecord[] = [];
  $(".view-content")
    .first()
    .children()
    .each((_, el) => {
      let date = $(el).find(".views-field.views-field-created").text().trim();
      let title = $(el).find(".views-field.views-field-title").text().trim();
      let link = $(el)
        .find(".views-field.views-field-title")
        .find("a")
        .attr("href");
      newsArr.push({ date, title, link: `${MAIN_URL}${link}` });
    });
  return newsArr;
};
