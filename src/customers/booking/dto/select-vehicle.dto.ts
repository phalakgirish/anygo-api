import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SelectVehicleDto {
  @ApiProperty({ example: 'Bike', description: 'Selected vehicle type',})
  @IsString()
  vehicleType: string;

  @ApiProperty({ example: 19.016, description: 'Pickup latitude' })
  @IsNumber()
  pickupLat: number;

  @ApiProperty({ example: 73.09, description: 'Pickup longitude' })
  @IsNumber()
  pickupLng: number;

  @ApiProperty({ example: 19.07, description: 'Drop latitude' })
  @IsNumber()
  dropLat: number;

  @ApiProperty({ example: 72.877, description: 'Drop longitude' })
  @IsNumber()
  dropLng: number;

  receiverName: string;
  
  receiverMobile: string;

  @ApiProperty()
  loadingRequired?: boolean;

  @ApiProperty()
  labourCount?: number;
}
