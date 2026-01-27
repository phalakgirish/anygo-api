import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    mobile: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}
