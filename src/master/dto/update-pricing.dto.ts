import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdatePricingDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFare?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(0)
  perKmRate?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isLoadingAvailable?: boolean;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(0)
  loadingChargePerLabour?: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
