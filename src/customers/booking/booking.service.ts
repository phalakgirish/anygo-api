import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleMapsService } from 'src/common/google-maps.service';
import { RouteCheckDto } from './dto/route-check.dto';
import { BookingEstimateDto } from './dto/booking-estimate.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SelectVehicleDto } from './dto/select-vehicle.dto';
import { ConfigService } from '@nestjs/config';
import { Booking } from './schemas/booking.schema';
import { Driver, DriverDocument } from 'src/drivers/schemas/driver.schema';
import { BookingStatus } from './dto/booking-status.dto';
import { LiveTrackingGateway } from 'src/gateways/live-tracking.gateway';
import { Pricing, PricingDocument } from './schemas/pricing.schema';
import { City, CityDocument } from 'src/master/schemas/city.schema';
import { Vehicle } from 'src/master/schemas/vehicle.schema';
import { DriversService } from 'src/drivers/drivers.service';
import { Customer } from '../schemas/customer.schema';

@Injectable()
export class BookingService {

  constructor(
    private readonly mapsService: GoogleMapsService,
    private readonly liveGateway: LiveTrackingGateway,
    private readonly driversService: DriversService,
    @InjectModel('Booking')
    private readonly bookingModel: Model<Booking>, private readonly configService: ConfigService,
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    @InjectModel(Pricing.name) private pricingModel: Model<PricingDocument>,
    @InjectModel(City.name) private CityModel: Model<CityDocument>,
    @InjectModel('Vehicle') private readonly vehicleModel: Model<Vehicle>,
    @InjectModel('Customer') private readonly customerModel: Model<Customer>,
  ) { }

  // STEP 1: route check (NO DB)
  async routeCheck(dto: RouteCheckDto) {
    const { distanceKm, durationMin } =
      await this.mapsService.getDistanceAndDuration(
        dto.pickupLat,
        dto.pickupLng,
        dto.dropLat,
        dto.dropLng,
      );

    return {
      distanceKm,
      durationMin,
    };
  }

  async getEstimate(dto: BookingEstimateDto) {
    const { distanceKm, durationMin } =
      await this.mapsService.getDistanceAndDuration(
        dto.pickupLat,
        dto.pickupLng,
        dto.dropLat,
        dto.dropLng,
      );

    const city = await this.mapsService.getCityFromLatLng(
      dto.pickupLat,
      dto.pickupLng,
    );

    // ✅ City must be active
    const cityExists = await this.CityModel.findOne({
      name: city,
      isActive: true,
    });

    if (!cityExists) {
      throw new BadRequestException({
        code: 'CITY_NOT_SUPPORTED',
        message: 'Service not available in this city',
      });
    }

    const vehicles = await this.vehicleModel.find({ isActive: true });

    const pricingList = await this.pricingModel.find({
      vehicleType: { $in: vehicles.map(v => v.vehicleType) },
      isActive: true,
    });

    const availableVehicles: {
      vehicleType: string;
      estimatedFare: number | null;
      etaMin: number;
      driversAvailable: number;
    }[] = [];

    for (const vehicle of vehicles) {
      // 🔥 USE EXISTING GEO FUNCTION
      const drivers =
        await this.driversService.findNearbyDrivers({
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          vehicleType: vehicle.vehicleType,
          radiusKm: 3, // or 5
        });

      if (!drivers.length) continue; // 🚫 hide vehicle

      const AVERAGE_SPEED_KMPH = 30;

      const nearestDriver = drivers[0]; // closest one

      const etaMin = Math.ceil(
        ((nearestDriver.distanceMeters / 1000) / AVERAGE_SPEED_KMPH) * 60
      );

      const pricing = pricingList.find(
        p => p.vehicleType === vehicle.vehicleType,
      );

      let estimatedFare: number | null = null;

      if (pricing) {
        estimatedFare = Math.round(
          Number(pricing.baseFare) +
          distanceKm * Number(pricing.perKmRate),
        );
      }

      availableVehicles.push({
        vehicleType: vehicle.vehicleType,
        estimatedFare,
        etaMin,
        driversAvailable: drivers.length,
      });
    }

    // 🚫 No vehicles = no service
    if (!availableVehicles.length) {
      throw new BadRequestException(
        'No drivers available nearby',
      );
    }

    return {
      distanceKm,
      durationMin,
      city,
      vehicles: availableVehicles,
    };
  }

  // 3️⃣ CREATE BOOKING + DISPATCH
  async createBooking(customerId: string, dto: SelectVehicleDto) {
    // 🔁 Recalculate (never trust frontend)
    const { distanceKm, durationMin } =
      await this.mapsService.getDistanceAndDuration(
        dto.pickupLat,
        dto.pickupLng,
        dto.dropLat,
        dto.dropLng,
      );

    const pickupCity = await this.mapsService.getCityFromLatLng(
      dto.pickupLat,
      dto.pickupLng,
    );

    // ✅ Check city exists in master
    const cityExists = await this.CityModel.findOne({
      name: pickupCity,
      isActive: true,
    });

    if (!cityExists) {
      throw new BadRequestException(
        'Booking is not available for this city',
      );
    }

    // ✅ Check drivers exist for this city
    const driverExistsInCity = await this.driverModel.exists({
      city: pickupCity,
      isOnline: true,
    });

    if (!driverExistsInCity) {
      throw new BadRequestException(
        'Booking is not available for this city',
      );
    }

    const customer = await this.customerModel
      .findById(customerId)
      .select('firstName lastName mobile')
      .lean();

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const customerName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
    const customerMobile = customer.mobile;

    const booking = await this.bookingModel.create({
      customerId,
      city: pickupCity,
      customerName,
      customerMobile,
      pickupLocation: { lat: dto.pickupLat, lng: dto.pickupLng },
      dropLocation: { lat: dto.dropLat, lng: dto.dropLng },
      vehicleType: dto.vehicleType,
      distanceKm,
      durationMin,
      loadingRequired: dto.loadingRequired === true,
      labourCount: dto.loadingRequired ? dto.labourCount ?? 0 : 0,
      status: BookingStatus.SEARCHING_DRIVER,
    });

    // 🔍 Find nearby drivers
    const drivers = await this.driversService.findNearbyDrivers({
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      vehicleType: dto.vehicleType,
      radiusKm: 3,
    });

    if (!drivers.length) {
      booking.status = BookingStatus.NO_DRIVER_FOUND;
      await booking.save();
      return { message: 'No drivers nearby' };
    }

    // 🔔 Notify drivers
    drivers.forEach(driver => {
      this.liveGateway.server
        .to(`driver:${driver._id}`)
        .emit('booking:request', {
          bookingId: booking._id,
          pickup: booking.pickupLocation,
          drop: booking.dropLocation,
        });
    });

    booking.status = BookingStatus.DRIVER_NOTIFIED;
    await booking.save();

    return { bookingId: booking._id };
  }

  // 4. COMMON HELPER
  private async findCurrentBooking(customerId: string) {
    const booking = await this.bookingModel.findOne({
      customerId,
      status: {
        $in: [
          BookingStatus.SEARCHING_DRIVER,
          BookingStatus.DRIVER_NOTIFIED,
          BookingStatus.DRIVER_ASSIGNED,
          BookingStatus.TRIP_STARTED,
          BookingStatus.NO_DRIVER_FOUND,
        ],
      },
    }).sort({ createdAt: -1 });

    if (!booking) {
      throw new BadRequestException('No active booking found');
    }

    return booking;
  }

  // 5.GET CURRENT BOOKING
  async getCurrentBooking(customerId: string) {
    return this.findCurrentBooking(customerId);
  }

  // 6. GET CURRENT BOOKING STATUS
  async getCurrentBookingStatus(customerId: string) {
    const booking = await this.findCurrentBooking(customerId);
    return { status: booking.status };
  }

  // 7. GET DRIVER LOCATION
  async getCurrentDriverLocation(customerId: string) {
    const booking = await this.findCurrentBooking(customerId);

    if (!booking.driverId) {
      throw new BadRequestException('Driver not assigned yet');
    }

    return booking.lastDriverLocation;
  }

  // 8.CANCEL CURRENT BOOKING
  async cancelCurrentBooking(customerId: string) {
    const booking = await this.findCurrentBooking(customerId);

    if (
      [BookingStatus.TRIP_STARTED, BookingStatus.TRIP_COMPLETED].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException('Cannot cancel at this stage');
    }

    booking.status = BookingStatus.CANCELLED;
    await booking.save();

    if (booking.driverId) {
      await this.driverModel.findByIdAndUpdate(booking.driverId, {
        isAvailable: true,
        isOnTrip: false,
      });
    }

    return { message: 'Booking cancelled successfully' };
  }

  // 9. Customer Live Tracking
  async getCurrentLiveBooking(customerId: string) {
    const booking = await this.findCurrentBooking(customerId);

    if (!booking) {
      return { status: 'NO_ACTIVE_BOOKING' };
    }

    const driver = booking.driverId
      ? await this.driverModel.findById(booking.driverId)
      : null;

    return {
      _id: booking._id,
      status: booking.status,

      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,

      driver: driver
        ? {
          name: driver.firstName,
          phone: driver.mobile,
          vehicleNumber: driver.vehicleNumber,
          currentLocation: driver.currentLocation?.coordinates?.length
            ? {
              lat: driver.currentLocation.coordinates[1],
              lng: driver.currentLocation.coordinates[0],
            }
            : null,
        }
        : null,
      routePath: booking.routePath, // ✅ IMPORTANT

      driverToPickupEtaMin: booking.driverToPickupEtaMin,
      pickupToDropEtaMin: booking.pickupToDropEtaMin,
      distanceKm: booking.distanceKm,
      finalFare: booking.finalFare,
    };
  }
}