import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type BookingEstimateDocument = BookingEstimate & Document;

@Schema({ timestamps: true })
export class BookingEstimate {
  @Prop({ required: true })
  customerId: string;

  @Prop()
  receiverName?: string;

  @Prop()
  receiverMobile?: string;
}

export const BookingEstimateSchema = SchemaFactory.createForClass(BookingEstimate);
