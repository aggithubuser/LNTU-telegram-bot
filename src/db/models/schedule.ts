import { Schema, Document, model } from "mongoose";

export interface ScheduleModel {
  _id: Schema.Types.ObjectId;
  name: String;
  link: String;
  folderId: String;
  isFile: Boolean;
  parent: String;
  createdAt: Date;
}

export const Schedule = model<ScheduleModel & Document>(
  "Schedule",
  new Schema({
    _id: Schema.Types.ObjectId,
    name: { type: String },
    link: { type: String, default: null },
    folderId: {
      type: String,
      default: null,
      unique: true,
    },
    isFile: { type: Boolean, default: false },
    parent: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
  })
);
