import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Driver } from '../../drivers/schemas/driver.schema';
import { Customer } from '../../customers/schemas/customer.schema';

import { ReportExportService } from './report-export.service';
import { ReportType } from '../dto/report-type.dto';
import { ExportType } from '../dto/export-type.dto';
import { Booking } from 'src/customers/booking/schemas/booking.schema';
import { ReportExportUtil } from './report-export.util';

@Injectable()
export class ReportService {

    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Driver.name) private driverModel: Model<Driver>,
        @InjectModel(Customer.name) private customerModel: Model<Customer>,
        private reportExportService: ReportExportService,
    ) { }

    // ================= DAILY DATE RANGE =================

    private getTodayRange() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        return { start, end };
    }

    // ================= MAIN DAILY REPORT DATA =================

    async getDailyReportData() {

        const { start, end } = this.getTodayRange();

        const [
            totalTrips,
            completedTrips,
            cancelledTrips,
            ongoingTrips,
            totalDrivers,
            totalCustomers,
            newCustomers,
            driversCompletedTrips,
            revenueData,
            averageFare,
            highestFare,
            lowestFare,
            customersBooked,
            onlinePayments,
            cashPayments,
            pendingPayments,
            activeDrivers
        ] = await Promise.all([

            this.bookingModel.countDocuments({ createdAt: { $gte: start, $lte: end } }),

            this.bookingModel.countDocuments({
                status: 'TRIP_COMPLETED',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                status: 'CANCELLED',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                status: { $in: ['DRIVER_ASSIGNED', 'TRIP_STARTED'] },
                createdAt: { $gte: start, $lte: end }
            }),

            this.driverModel.countDocuments(),

            this.customerModel.countDocuments(),

            this.customerModel.countDocuments({
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                status: 'TRIP_COMPLETED',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.aggregate([
                { $match: { status: 'TRIP_COMPLETED', createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: null, total: { $sum: '$finalFare' } } }
            ]),

            this.bookingModel.aggregate([
                { $match: { status: 'TRIP_COMPLETED', createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: null, avg: { $avg: '$finalFare' } } }
            ]),

            this.bookingModel.aggregate([
                { $match: { status: 'TRIP_COMPLETED', createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: null, max: { $max: '$finalFare' } } }
            ]),

            this.bookingModel.aggregate([
                { $match: { status: 'TRIP_COMPLETED', createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: null, min: { $min: '$finalFare' } } }
            ]),

            this.bookingModel.distinct('customerId', {
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                paymentMethod: 'ONLINE',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                paymentMethod: 'CASH',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.countDocuments({
                paymentStatus: 'PENDING',
                createdAt: { $gte: start, $lte: end }
            }),

            this.bookingModel.distinct('driverId', {
                createdAt: { $gte: start, $lte: end }
            })

        ]);

        const successRate = totalTrips
            ? ((completedTrips / totalTrips) * 100).toFixed(1)
            : 0;

        return {
            totalTrips,
            completedTrips,
            cancelledTrips,
            ongoingTrips,
            successRate,

            totalRevenue: revenueData[0]?.total || 0,
            averageFare: Math.round(averageFare[0]?.avg || 0),
            highestFare: highestFare[0]?.max || 0,
            lowestFare: lowestFare[0]?.min || 0,

            newCustomers,
            customersBooked: customersBooked.length,
            totalCustomers,

            totalDrivers,
            activeDrivers: activeDrivers.length,
            driversCompletedTrips,

            onlinePayments,
            cashPayments,
            pendingPayments
        };
    }

    // ================= PDF REPORT =================

    async generateDailyPDF() {

        const stats = await this.getDailyReportData();

        return ReportExportUtil.dailyReportPDF(stats);
    }

}