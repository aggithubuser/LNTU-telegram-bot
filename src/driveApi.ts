import fetch from "node-fetch";

export interface Folder {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    createdTime: string;
    modifiedTime: string;
  }>;
}

export const folderContent = async (id: string) => {
  let link = `https://www.googleapis.com/drive/v3/files?q='${id}'%20in%20parents&fields=nextPageToken%2C%20files(id%2C%20name%2C%20mimeType%2CwebContentLink%2CwebViewLink%2CcreatedTime%2CmodifiedTime)&key=${process.env.DRIVE_TOKEN}`;
  // let link = `https://www.googleapis.com/drive/v3/files?q=%27${id}%27%20in%20parents&fields=nextPageToken%2C%20files(id%2C%20name%2C%20mimeType%2CwebContentLink%2CwebViewLink%2CcreatedTime%2CmodifiedTime)&key=${process.env.DRIVE_TOKEN}`;
  const response = await fetch(link);
  const folderResult: Promise<Folder> = await response.json();
  return folderResult;
};
