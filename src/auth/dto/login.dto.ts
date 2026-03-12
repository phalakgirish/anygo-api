import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMobilePhone, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsMobilePhone('en-IN')
  mobile: string;

  @ApiProperty()
  @IsString()
  password: string;

  // 🔔 FCM TOKEN
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
