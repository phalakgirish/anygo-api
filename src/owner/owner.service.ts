import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { Owner, OwnerDocument } from './schemas/owner.schema';
import { Booking, BookingDocument } from 'src/customers/booking/schemas/booking.schema';
import { Driver, DriverDocument } from 'src/drivers/schemas/driver.schema';
import { Withdraw, WithdrawDocument } from 'src/drivers/schemas/withdraw.schema';
import { GoogleMapsService } from 'src/common/google-maps.service';
import { Customer, CustomerDocument } from 'src/customers/schemas/customer.schema';
import { UpdateProfileDto } from './dto/profile-update.dto';
import { BookingStatus } from 'src/customers/booking/dto/booking-status.dto';

@Injectable()
export class OwnerService {
  constructor(
    @InjectModel(Owner.name) private ownerModel: Model<OwnerDocument>,
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    @InjectModel(Withdraw.name) private withdrawModel: Model<WithdrawDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private readonly mapsService: GoogleMapsService,) { }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // 1. Owner Registration
  async create(createOwnerDto: CreateOwnerDto): Promise<Partial<Owner>> {
    const { email, password, ...rest } = createOwnerDto;
    // explicit email uniqueness check before creation
    const exists = await this.ownerModel.findOne({ email }).lean();
    if (exists) {
      throw new ConflictException('Email is already registered');
    }

    const hashed = await this.hashPassword(password);
    const created = new this.ownerModel({ ...rest, email, password: hashed });

    try {
      const saved = await created.save();
      // remove password before returning
      const { password: _, ...safe } = saved.toObject();
      return safe;
    } catch (err: any) {
      // handle Mongo duplicate key (race conditions)
      if (err?.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      // fallback
      console.error('create owner error', err);
      throw new InternalServerErrorException('Failed to create owner');
    }
  }

  async findByMobile(mobile: string): Promise<Partial<Owner>> {
    const owner = await this.ownerModel.findOne({ mobile }).lean();

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    const { password, ...safe } = owner;
    return safe;
  }

  // optional: get by email (for login)
  findByEmail(email: string) {
    return this.ownerModel.findOne({ email }).lean();
  }

  // ================= DRIVER LIST (FIXED) =================
  async getAllDrivers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [drivers, total] = await Promise.all([
      this.driverModel
        .find()
        .skip(skip)
        .limit(limit)
        .lean(),

      this.driverModel.countDocuments(),
    ]);

    return {
      status: true,
      data: drivers.map(driver => ({
        id: driver._id,
        name: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
        mobile: driver.mobile,
        status: driver.status,
        isAvailable: driver.isAvailable,
        isOnline: driver.isOnline,
        documents: driver.documents
          ? {
            uploaded: true,
            source: driver.documents.source || 'MANUAL',
            verified: driver.documents.verified || false,
          }
          : {
            uploaded: false,
          },
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 3. DRIVER DETAILS
  async getDriverDetails(driverId: string) {
    const driver = await this.driverModel.findById(driverId).lean();

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const baseUrl = 'http://3.108.186.215:5000/uploads';
    // const baseUrl = 'https://localhost:5000/uploads';
    // const driverFolder = `driver-documents/${driver._id}`;

    return {
      driver: {
        id: driver._id,
        name: `${driver.firstName} ${driver.lastName}`,
        mobile: driver.mobile,
        isOnline: driver.isOnline,
        isAvailable: driver.isAvailable,

        vehicle: {
          type: driver.vehicleType,
          model: driver.vehicleModel,
          number: driver.vehicleNumber,
          make: driver.vehicleMake,
          chassisNumber: driver.chassisNumber,
          isOnline: driver.isOnline,
          isAvailable: driver.isAvailable,
          city: driver.city,
        },

        status: driver.status,

        documents: driver.documents
          ? {
            source: driver.documents.source || 'MANUAL',
            verified: driver.documents.verified || false,

            aadhaar: driver.documents.aadhaar
              ? `${baseUrl}/${driver.documents.aadhaar}`
              : null,

            panCard: driver.documents.panCard
              ? `${baseUrl}/${driver.documents.panCard}`
              : null,

            licenseFront: driver.documents.licenseFront
              ? `${baseUrl}/${driver.documents.licenseFront}`
              : null,

            licenseBack: driver.documents.licenseBack
              ? `${baseUrl}/${driver.documents.licenseBack}`
              : null,
          }
          : null,
      },
    };
  }

  // 4. Driver Document Approve 
  async approveDriverDocuments(driverId: string) {
    const driver = await this.driverModel.findById(driverId);

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (!driver.documents) {
      throw new BadRequestException('No documents uploaded');
    }

    driver.documents.verified = true;

    await driver.save();

    return {
      message: 'Driver documents approved successfully',
    };
  }

  // 5. Driver Document Reject 
  async rejectDriverDocuments(driverId: string, reason?: string) {
    const driver = await this.driverModel.findById(driverId);

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (!driver.documents) {
      throw new BadRequestException('No documents uploaded');
    }

    driver.documents.verified = false;

    await driver.save();

    return {
      message: 'Driver documents rejected',
    };
  }

  // 6. Customer Booking deatils
  async getAllBookings(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.bookingModel.countDocuments(),
    ]);

    // collect all driverIds (only valid ones)
    const driverIds = bookings
      .map(b => b.driverId)
      .filter(id => typeof id === 'string');

    // fetch drivers in ONE query (important!)
    const drivers = await this.driverModel
      .find({ _id: { $in: driverIds } })
      .select('firstName lastName mobile')
      .lean();

    // map for fast lookup
    const driverMap = new Map(
      drivers.map(d => [d._id.toString(), d])
    );

    const data = await Promise.all(
      bookings.map(async b => {
        const driver = b.driverId
          ? driverMap.get(b.driverId.toString())
          : null;

        return {
          bookingId: b._id,

          driverName: driver
            ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim()
            : 'Not Assigned',

          driverMobile: driver?.mobile || '—',

          pickupPoint: b.pickupLocation
            ? {
              lat: b.pickupLocation.lat,
              lng: b.pickupLocation.lng,
              address: await this.mapsService.getCityFromLatLng(
                b.pickupLocation.lat,
                b.pickupLocation.lng,
              ),
            }
            : null,

          dropPoint: b.dropLocation
            ? {
              lat: b.dropLocation.lat,
              lng: b.dropLocation.lng,
              address: await this.mapsService.getCityFromLatLng(
                b.dropLocation.lat,
                b.dropLocation.lng,
              ),
            }
            : null,

          customerId: b.customerId,
          amount: b.finalFare || 0,
          status: b.status,
        };
      })
    );
    return {
      data,
      pagination: {
        totalRecords: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 7. TRIP MANAGEMENT (Driver-wise summary)
  async getTripManagement(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    // 1. Get paginated drivers
    const [drivers, total] = await Promise.all([
      this.driverModel
        .find()
        .select('firstName lastName mobile vehicleType')
        .skip(skip)
        .limit(limit)
        .lean(),

      this.driverModel.countDocuments(),
    ]);

    // 2. Get all bookings
    const bookings = await this.bookingModel
      .find()
      .select('driverId status')
      .lean();

    // 3. Group bookings by driverId
    const bookingMap = new Map<string, any[]>();

    for (const booking of bookings) {
      if (!booking.driverId) continue;

      const driverId = booking.driverId.toString();
      if (!bookingMap.has(driverId)) {
        bookingMap.set(driverId, []);
      }
      bookingMap.get(driverId)?.push(booking);
    }

    // 4. Prepare response
    const data = drivers.map(driver => {
      const driverId = driver._id.toString();
      const driverBookings = bookingMap.get(driverId) || [];

      const totalTrips = driverBookings.length;

      const completedTrips = driverBookings.filter(
        b => b.status === 'TRIP_COMPLETED'
      ).length;

      const ongoingTrips = driverBookings.filter(
        b =>
          b.status === 'TRIP_STARTED' ||
          b.status === 'DRIVER_ASSIGNED'
      ).length;

      return {
        driverId,
        driverName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
        driverMobile: driver.mobile,
        vehicleType: driver.vehicleType || '—',
        totalTrips,
        completedTrips,
        ongoingTrips,
      };
    });

    return {
      status: true,
      data,
      pagination: {
        totalRecords: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 8. APPROVE WITHDRAWAL
  async approveWithdrawal(withdrawalId: string) {
    const withdraw = await this.withdrawModel.findOne({
      _id: withdrawalId,
      status: 'PENDING',
    });

    if (!withdraw) {
      throw new BadRequestException('No pending withdrawal request');
    }

    const driver = await this.driverModel.findById(withdraw.driverId);
    if (!driver) throw new BadRequestException('Driver not found');

    if ((driver.walletBalance || 0) < withdraw.amount) {
      throw new BadRequestException('Insufficient balance at approval time');
    }

    // ✅ DEDUCT MONEY ONLY ON APPROVAL
    driver.walletBalance -= withdraw.amount;
    await driver.save();

    withdraw.status = 'APPROVED';
    await withdraw.save();

    return {
      message: 'Withdrawal approved successfully',
    };
  }

  // 9. REJECT WITHDRAWAL 
  async rejectWithdrawal(withdrawalId: string) {
    const withdraw = await this.withdrawModel.findOne({
      _id: withdrawalId,
      status: 'PENDING',
    });

    if (!withdraw) {
      throw new BadRequestException('No pending withdrawal request');
    }

    // ❗ NO WALLET CHANGES
    withdraw.status = 'REJECTED';
    await withdraw.save();

    return {
      message: 'Withdrawal rejected successfully',
    };
  }

  // 10. Owner: Get all withdrawal requests
  async getAllWithdrawals() {
    return this.withdrawModel
      .find()
      .populate('driverId', 'firstName lastName mobile')
      .sort({ createdAt: -1 });
  }

  //11. CUSTOMER LIST (FIXED) 
  async getAllCustomers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([this.customerModel
      .find()
      .skip(skip)
      .limit(limit)
      .lean(),

    this.customerModel.countDocuments(),
    ]);

    return {
      status: true,
      data: customers.map(customer => ({
        id: customer._id,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        mobile: customer.mobile,
        email: customer.email
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 12. Admin Dashboard
  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    const [
      totalTrips,
      totalDrivers,
      totalCustomers,
      cancelledTrips,
      completedTrips,
      ongoingTrips,
      todaysTrips,
      revenue,
    ] = await Promise.all([
      this.bookingModel.countDocuments(), //totalTrips
      this.driverModel.countDocuments(),  //totalDrivers
      this.customerModel.countDocuments(), //totalCustomers
      this.bookingModel.countDocuments({ status: 'CANCELLED' }), //cancelled Trips
      this.bookingModel.countDocuments({ status: 'TRIP_COMPLETED', }), //completed Trips
      this.bookingModel.countDocuments({
        status: { $in: ['DRIVER_NOTIFIED', 'DRIVER_ASSIGNED', 'TRIP_STARTED'] },
      }), //Ongoing Trips
      this.bookingModel.countDocuments({
        createdAt: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      }), // todaysTrips
      this.bookingModel.aggregate([
        {
          $match: {
            status: { $in: ['TRIP_COMPLETED', 'COMPLETED'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$finalFare' },
          },
        },
      ]),
    ]);

    return {
      totalTrips,
      totalDrivers,
      totalCustomers,
      cancelledTrips,
      completedTrips,
      ongoingTrips,
      todaysTrips,
      totalRevenue: revenue[0]?.total || 0,
    };
  }
  
  // Ongoing Trips
  async getOngoingTrips(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const statusFilter = {
      $in: [
        'DRIVER_NOTIFIED',
        'DRIVER_ASSIGNED',
        'TRIP_STARTED',
      ],
    };

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find({ status: statusFilter })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.bookingModel.countDocuments({ status: statusFilter }),
    ]);

    const driverIds = bookings
      .map(b => b.driverId)
      .filter(id => typeof id === 'string');

    const customerIds = bookings
      .map(b => b.customerId)
      .filter(id => typeof id === 'string');

    const [drivers, customers] = await Promise.all([
      this.driverModel
        .find({ _id: { $in: driverIds } })
        .select('firstName lastName mobile')
        .lean(),

      this.customerModel
        .find({ _id: { $in: customerIds } })
        .select('firstName lastName mobile')
        .lean(),
    ]);

    const driverMap = new Map(
      drivers.map(d => [d._id.toString(), d]),
    );

    const customerMap = new Map(
      customers.map(c => [c._id.toString(), c]),
    );

    const data = await Promise.all(
      bookings.map(async b => {
        const driver = b.driverId
          ? driverMap.get(b.driverId.toString())
          : null;

        const customer = b.customerId
          ? customerMap.get(b.customerId.toString())
          : null;

        const pickupAddress = b.pickupLocation
          ? await this.mapsService.getCityFromLatLng(
            b.pickupLocation.lat,
            b.pickupLocation.lng,
          )
          : null;

        const dropAddress = b.dropLocation
          ? await this.mapsService.getCityFromLatLng(
            b.dropLocation.lat,
            b.dropLocation.lng,
          )
          : null;

        return {
          bookingId: b._id,

          driverName: driver
            ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim()
            : 'Not Assigned',

          driverMobile: driver?.mobile || '—',

          customerName: customer
            ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
            : '—',

          customerMobile: customer?.mobile || '—',

          pickupPoint: {
            lat: b.pickupLocation?.lat,
            lng: b.pickupLocation?.lng,
            address: pickupAddress,
          },

          dropPoint: {
            lat: b.dropLocation?.lat,
            lng: b.dropLocation?.lng,
            address: dropAddress,
          },
          status: b.status
        };
      }),
    );

    return {
      data,
      pagination: {
        totalRecords: total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Month-wose Trip Amount (BAR CHART)
  async getMonthWiseRevenue() {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = await this.bookingModel.aggregate([
      { $match: { status: { $in: ['TRIP_COMPLETED', 'COMPLETED'] }, createdAt: { $gte: startOfYear } } },
      { $group: { _id: { $month: '$createdAt' }, amount: { $sum: '$finalFare' } } }
    ]);

    const map = new Map(data.map(d => [d._id, d.amount]));
    return monthNames.map((m, i) => ({
      month: m, amount: map.get(i + 1) || 0
    }));
  }

  // Weekly Trips (LINE CHART)
  async getWeeklyTrips() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 34); // last 5 weeks

    const data = await this.bookingModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: { $isoWeek: '$createdAt' }, trips: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Use the earliest week from the data as the starting week
    const firstWeek = data.length ? Math.min(...data.map(d => d._id)) : this.getISOWeek(today);
    const weeks = Array.from({ length: 5 }, (_, i) => firstWeek + i); // minimal change here

    const map = new Map(data.map(d => [d._id, d.trips]));

    return weeks.map((w, i) => ({ week: `Week ${i + 1}`, count: map.get(w) || 0 }));
  }

  //Monthly Vehicle Registrations (LINE CHART)
  async getMonthlyVehicleRegistrations() {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = await this.driverModel.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } }
    ]);

    const map = new Map(data.map(d => [d._id, d.count]));
    return monthNames.map((m, i) => ({ month: m, count: map.get(i + 1) || 0 }));
  }

  private getISOWeek(date: Date) {
    const tmp = new Date(date.getTime());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
    const yearStart = new Date(tmp.getFullYear(), 0, 1);
    return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // ONE Method for ADMIN Dashboard
  async getAdminDashboard() {
    const [
      stats,
      monthWiseRevenue,
      weeklyTrips,
      monthlyVehicleRegistrations,
      ongoingTrips,
      withdrawals,
    ] = await Promise.all([
      this.getDashboardStats(),            // TOP CARDS
      this.getMonthWiseRevenue(),          // BAR CHART
      this.getWeeklyTrips(),               // LINE CHART
      this.getMonthlyVehicleRegistrations(), // LINE CHART
      this.getOngoingTrips(),              // TABLE
      this.getAllWithdrawals(),            // TABLE
    ]);

    return {
      stats,
      charts: {
        monthWiseRevenue,
        weeklyTrips,
        monthlyVehicleRegistrations,
      },
      ongoingTrips,
      withdrawals,
    };
  }

  // Owner Profile
  async getProfile(ownerId: string) {
    const owner = await this.ownerModel.findById(ownerId).select(
      'firstName lastName mobile email'
    );

    if (!owner) {
      throw new BadRequestException('Owner not found');
    }

    return {
      firstName: owner.firstName,
      lastName: owner.lastName,
      mobile: owner.mobile,
      email: owner.email,
    };
  }

  // Update Owner Profile 
  async updateProfile(ownerId: string, dto: UpdateProfileDto) {
    const owner = await this.ownerModel.findByIdAndUpdate(
      ownerId,
      { $set: dto },
      { new: true }
    ).select('firstName lastName mobile email');

    if (!owner) {
      throw new BadRequestException('Owner not found');
    }

    return {
      message: 'Profile updated successfully',
      profile: owner,
    };
  }

  // 13. Driver Payment (MONTH-WISE)
  async getDriverPaymentSummary(
    month?: number,
    year?: number,
    from?: Date,
    to?: Date,
    driverName?: string,
    page = 1,
    limit = 10,) {
    const skip = (page - 1) * limit;

    // Default → current month & year
    const now = new Date();
    const selectedMonth = month ?? now.getMonth() + 1; // 1-12
    const selectedYear = year ?? now.getFullYear();

    // 📅 Month range
    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

    // OPTIONAL OVERRIDE (Reports only)
    const startDate = from ?? startOfMonth;
    const endDate = to ?? endOfMonth;

    // Optional driver filter
    const driverIds = await this.getDriverIdsByName(driverName);

    const driverMatch =
      driverIds.length > 0
        ? [{ $match: { _id: { $in: driverIds } } }]
        : [];

    const result = await this.driverModel.aggregate([
      // Optional driver filter (ONLY if passed)
      ...driverMatch,

      // 1️⃣ Active drivers
      {
        $match: { isDeleted: { $ne: true } },
      },

      // 2️⃣ Month-wise completed trips
      {
        $lookup: {
          from: 'bookings',
          let: { driverId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        { $toObjectId: '$driverId' }, '$$driverId'],
                    },
                    { $eq: ['$status', BookingStatus.TRIP_COMPLETED] },
                    { $gte: ['$tripEndTime', startDate] },
                    { $lte: ['$tripEndTime', endDate] },
                  ],
                },
              },
            },
          ],
          as: 'monthlyTrips',
        },
      },

      // 3️⃣ Month-wise approved withdrawals
      {
        $lookup: {
          from: 'withdraws',
          let: { driverId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$driverId', '$$driverId'] },
                    { $eq: ['$status', 'APPROVED'] },
                    { $gte: ['$createdAt', startDate] },
                    { $lte: ['$createdAt', endDate] },
                  ],
                },
              },
            },
          ],
          as: 'monthlyWithdrawals',
        },
      },

      // 4️⃣ Final response structure
      {
        $project: {
          driverName: {
            $trim: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
            },
          },
          mobile: 1,

          totalTrips: { $size: '$monthlyTrips' },

          monthWiseEarnings: {
            $sum: '$monthlyTrips.driverEarning',
          },

          withdrawalAmount: {
            $sum: '$monthlyWithdrawals.amount',
          },

          // NEW (Earnings Report)
          totalFare: {
            $sum: '$monthlyTrips.finalFare',
          },
          platformCommission: {
            $sum: '$monthlyTrips.platformCommission',
          },
          driverEarning: {
            $sum: '$monthlyTrips.driverEarning',
          },
        },
      },

      // 5️⃣ Optional: sort by earnings (top drivers first)
      {
        $sort: { monthWiseEarnings: -1 },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [
            { $count: 'count' },
          ],
        },
      },
    ]);

    const data = result[0]?.data ?? [];
    const totalRecords = result[0]?.totalCount[0]?.count ?? 0;

    return {
      month: selectedMonth,
      year: selectedYear,
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  // 14. Admin Panel Reports
  async getDriverPerformanceReport(
    filters: {
      from?: string;
      to?: string;
      driverName?: string;
    },
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const matchTrips: any = {};

    // Date filter → based on CREATED booking
    if (filters.from || filters.to) {
      matchTrips.createdAt = {};
      if (filters.from) matchTrips.createdAt.$gte = new Date(filters.from);
      if (filters.to) matchTrips.createdAt.$lte = new Date(filters.to);
    }

    const driverIds = await this.getDriverIdsByName(filters.driverName);

    const driverMatch =
      driverIds.length > 0
        ? [{ $match: { _id: { $in: driverIds } } }]
        : [];

    const result = await this.driverModel.aggregate([
      ...driverMatch,

      {
        $lookup: {
          from: 'bookings',
          let: { driverId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$driverId', '$$driverId'] },
                ...matchTrips,
              },
            },
          ],
          as: 'trips',
        },
      },

      {
        $project: {
          driverName: { $concat: ['$firstName', ' ', '$lastName'] },
          Status: '$isOnline', // ACTIVE / INACTIVE
          totalTrips: { $size: '$trips' },

          cancelledTrips: {
            $size: {
              $filter: {
                input: '$trips',
                as: 't',
                cond: { $eq: ['$$t.status', 'CANCELLED'] },
              },
            },
          },

          acceptanceRate: {
            $cond: [
              { $gt: [{ $size: '$trips' }, 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$trips',
                            as: 't',
                            cond: { $ne: ['$$t.status', 'CANCELLED'] },
                          },
                        },
                      },
                      { $size: '$trips' },
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },

      // 🔹 PAGINATION (ONLY ADDITION)
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const data = result[0]?.data ?? [];
    const totalRecords = result[0]?.totalCount[0]?.count ?? 0;

    return {
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  // Trip Report
  async getTripReport(
    filters: {
      from?: string;
      to?: string;
      driverName?: string;
    },
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const match: any = {};

    // Date filters
    if (filters.from || filters.to) {
      match.createdAt = {};
      if (filters.from) match.createdAt.$gte = new Date(filters.from);
      if (filters.to) match.createdAt.$lte = new Date(filters.to);
    }

    // Driver filter
    const driverIds = await this.getDriverIdsByName(filters.driverName);
    const driverIdStrings = driverIds.map(id => id.toString());

    if (driverIdStrings.length) {
      match.driverId = { $in: driverIdStrings };
    }

    const result = await this.bookingModel.aggregate([
      { $match: match },

      {
        $lookup: {
          from: 'drivers',
          let: { driverId: { $toObjectId: '$driverId' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$driverId'] },
              },
            },
          ],
          as: 'driver',
        },
      },

      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },

      {
        $project: {
          tripId: '$_id',
          tripDate: '$createdAt',
          tripStartTime: 1,
          tripEndTime: 1,

          pickupLocation: '$city',
          dropLocation: '$city',

          driverName: {
            $cond: [
              { $ifNull: ['$driver', false] },
              { $concat: ['$driver.firstName', ' ', '$driver.lastName'] },
              'Not Assigned',
            ],
          },

          city: 1,
          status: 1,
          finalFare: 1,
          driverEarning: 1,
        },
      },

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const data = result[0]?.data ?? [];
    const totalRecords = result[0]?.totalCount[0]?.count ?? 0;

    return {
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  // Cancellation Report
  async getCancellationReport(
    filters: {
      from?: string;
      to?: string;
      driverName?: string;
    },
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const match: any = { status: 'CANCELLED' };

    // Date filters
    if (filters.from || filters.to) {
      match.createdAt = {};
      if (filters.from) match.createdAt.$gte = new Date(filters.from);
      if (filters.to) match.createdAt.$lte = new Date(filters.to);
    }

    // Driver filter
    const driverIds = await this.getDriverIdsByName(filters.driverName);
    const driverIdStrings = driverIds.map(id => id.toString());

    if (driverIdStrings.length) {
      match.driverId = { $in: driverIdStrings };
    }

    const result = await this.bookingModel.aggregate([
      { $match: match },

      {
        $lookup: {
          from: 'drivers',
          let: { driverId: { $toObjectId: '$driverId' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$driverId'] },
              },
            },
          ],
          as: 'driver',
        },
      },

      { $unwind: '$driver' },

      {
        $group: {
          _id: '$driver._id',
          driverName: {
            $first: {
              $concat: ['$driver.firstName', ' ', '$driver.lastName'],
            },
          },
          count: { $sum: 1 },
        },
      },

      {
        $project: {
          _id: 0,
          driverName: 1,
          count: 1,
        },
      },

      // 🔹 PAGINATION (ONLY ADDITION)
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const data = result[0]?.data ?? [];
    const totalRecords = result[0]?.totalCount[0]?.count ?? 0;

    return {
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  // 🔹 Payment Report (PAGINATED)
  async getPaymentReport(
    filters: {
      from?: string;
      to?: string;
      driverName?: string;
    },
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const match: any = {
      status: BookingStatus.TRIP_COMPLETED,
    };

    // Date filter
    if (filters.from || filters.to) {
      match.tripEndTime = {};
      if (filters.from) match.tripEndTime.$gte = new Date(filters.from);
      if (filters.to) match.tripEndTime.$lte = new Date(filters.to);
    }

    // Driver filter
    const driverIds = await this.getDriverIdsByName(filters.driverName);
    if (driverIds.length) {
      match.driverId = { $in: driverIds.map(id => id.toString()) };
    }

    const result = await this.bookingModel.aggregate([
      { $match: match },

      // 🔹 Join Customer
      {
        $lookup: {
          from: 'customers',
          let: { customerId: { $toObjectId: '$customerId' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$customerId'] },
              },
            },
          ],
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },

      // 🔹 Join Driver
      {
        $lookup: {
          from: 'drivers',
          let: { driverId: { $toObjectId: '$driverId' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$driverId'] },
              },
            },
          ],
          as: 'driver',
        },
      },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },

      // 🔹 Final Projection
      {
        $project: {
          tripId: '$_id',
          tripDate: '$tripEndTime',

          customerName: {
            $cond: [
              { $ifNull: ['$customer', false] },
              { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
              'Unknown',
            ],
          },

          driverName: {
            $cond: [
              { $ifNull: ['$driver', false] },
              { $concat: ['$driver.firstName', ' ', '$driver.lastName'] },
              'Not Assigned',
            ],
          },

          vehicleType: 1,
          finalFare: 1,

          paymentMethod: 1,
          paymentStatus: 1,

          transactionId: {
            $cond: [
              { $eq: ['$paymentMethod', 'ONLINE'] },
              '$razorpayPaymentId',
              null,
            ],
          },
        },
      },

      { $sort: { tripDate: -1 } },

      // 🔹 PAGINATION (ONLY ADDITION)
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const data = result[0]?.data ?? [];
    const totalRecords = result[0]?.totalCount[0]?.count ?? 0;

    return {
      data,
      pagination: {
        totalRecords,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  // 🔹 DRIVER PERFORMANCE DATA
  async getDriverPerformanceData(filters): Promise<any[]> {
    const result = await this.getDriverPerformanceReport(filters, 1, Number.MAX_SAFE_INTEGER);
    return result.data;
  }

  // 🔹 TRIP REPORT DATA
  async getTripReportData(filters): Promise<any[]> {
    const result = await this.getTripReport(filters, 1, Number.MAX_SAFE_INTEGER);
    return result.data;
  }

  // 🔹 CANCELLATION DATA
  async getCancellationReportData(filters): Promise<any[]> {
    const result = await this.getCancellationReport(filters, 1, Number.MAX_SAFE_INTEGER);
    return result.data;
  }

  // 🔹 EARNINGS DATA (only data array)
  async getEarningsReportData(filters): Promise<any[]> {
    const result = await this.getDriverPaymentSummary(
      undefined,
      undefined,
      filters.from ? new Date(filters.from) : undefined,
      filters.to ? new Date(filters.to) : undefined,
      filters.driverName,
    );
    return result.data;
  }

  // 🔹 Payment Report DATA
  async getPaymentReportData(filters): Promise<any[]> {
    const result = await this.getPaymentReport(filters, 1, Number.MAX_SAFE_INTEGER,);
    return result.data;
  }

  // Resolve driverIds from driverName (frontend-friendly)
  private async getDriverIdsByName(driverName?: string): Promise<Types.ObjectId[]> {
    if (!driverName) return [];

    const parts = driverName.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const drivers = await this.driverModel.find(
      {
        firstName: new RegExp(`^${firstName}`, 'i'),
        ...(lastName && {
          lastName: new RegExp(`^${lastName}`, 'i'),
        }),
      },
      { _id: 1 }
    );

    return drivers.map(d => d._id);
  }

}