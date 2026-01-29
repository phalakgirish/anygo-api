import { Controller, Post, Body, UseGuards, Req, Get, Param, Query } from '@nestjs/common';
import { BookingService } from './booking.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CustomerGuard } from '../customer.guard';
import { RouteCheckDto } from './dto/route-check.dto';
import { SelectVehicleDto } from './dto/select-vehicle.dto';
import { BookingEstimateDto } from './dto/booking-estimate.dto';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('route-check')
  @ApiOperation({ summary: 'Check route distance and duration' })
  routeCheck(@Body() dto: RouteCheckDto) {
    return this.bookingService.routeCheck(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('estimate')
  @ApiOperation({ summary: 'Get fare estimate before booking' })
  getEstimate( @Req() req, @Body() dto: BookingEstimateDto,) {
  return this.bookingService.getEstimate(req.customerId, dto);
}

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('create')
  @ApiOperation({ summary: 'Create booking after vehicle selection' })
  create(@Req() req, @Body() dto: SelectVehicleDto) {
    return this.bookingService.createBooking(req.customerId, dto,);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Get('current')
  @ApiOperation({ summary: 'Get current active booking' })
  getCurrentBooking(@Req() req) {
    return this.bookingService.getCurrentBooking(req.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Get('current/status')
  getCurrentBookingStatus(@Req() req) {
    return this.bookingService.getCurrentBookingStatus(req.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Get('current/driver-location')
  getCurrentDriverLocation(@Req() req) {
    return this.bookingService.getCurrentDriverLocation(req.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('current/cancel')
  cancelCurrentBooking(@Req() req) {
    return this.bookingService.cancelCurrentBooking(req.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Get('vehicle-pricing')
  getVehiclePricing(@Query('vehicleType') vehicleType: string,) {
    return this.bookingService.getVehiclePricing(vehicleType);
  }
}