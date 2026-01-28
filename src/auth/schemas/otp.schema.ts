import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  mobile: string;

  @Prop({ required: false })
  otp: string;

  @Prop({ required: true })
  userType: string;

  @Prop({ type: Object })
  payload: any; // customer/driver/owner registration data

  @Prop({ default: false })
  verified: boolean;

  @Prop({ type: Date })
  expiresAt: Date; 

  @Prop({ enum: ['FORGOT_PASSWORD'] })
  purpose: string;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
