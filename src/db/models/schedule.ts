import { Schema, Document, model } from "mongoose";

export interface ScheduleModel {
  _id: Schema.Types.ObjectId;
  name: String;
  link: String;
  folderId: String;
  isFile: Boolean;
  parent: String | null;
  serverUpdatedAt: Date;
  serverCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema({
  _id: Schema.Types.ObjectId,
  name: { type: String },
  link: { type: String, default: null },
  folderId: {
    type: String,
    default: null,
  },
  isFile: { type: Boolean, default: false },
  parent: { type: String, default: null },
  serverCreatedAt: { type: Date, default: null },
  serverUpdatedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: null },
});

scheduleSchema.index({ name: 1, folderId: 1 }, { unique: true });

export const Schedule = model<ScheduleModel & Document>(
  "Schedule",
  scheduleSchema
);
