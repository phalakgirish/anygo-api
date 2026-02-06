import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { OwnerService } from './owner.service';
import { OwnerJwtGuard } from 'src/master/owner-jwt.guard';
import { UpdateProfileDto } from './dto/profile-update.dto';
import type { Response } from 'express';
import { ReportType } from './dto/report-type.dto';
import { ExportType } from './dto/export-type.dto';
import { ReportExportService } from './reports/report-export.service';

@ApiTags('Admin')
@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService,
    private readonly reportExportService: ReportExportService,
  ) { }

  @Post('register')
  async register(@Body() createOwnerDto: CreateOwnerDto) {
    const owner = await this.ownerService.create(createOwnerDto);
    return {
      statusCode: 201,
      message: 'Owner registered successfully',
      data: owner,
    };
  }

  @Get('mobile/:mobile')
  async getOwnerByMobile(@Param('mobile') mobile: string) {
    const owner = await this.ownerService.findByMobile(mobile);
    return {
      statusCode: 200,
      message: 'Owner details fetched successfully',
      data: owner,
    };
  }

  // All Drivers 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('drivers')
  getDrivers(@Query('page') page = 1, @Query('limit') limit = 10,) {
    return this.ownerService.getAllDrivers(Number(page), Number(limit),);
  }

  // Driver full details
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('drivers/:id')
  getDriverById(@Param('id') driverId: string) {
    return this.ownerService.getDriverDetails(driverId);
  }

  // Document Approve   
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Patch('drivers/:driverId/documents/approve')
  approveDriverDocuments(@Param('driverId') driverId: string) {
    return this.ownerService.approveDriverDocuments(driverId);
  }

  // Document Reject
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Patch('drivers/:driverId/documents/reject')
  rejectDriverDocuments(
    @Param('driverId') driverId: string,
    @Body('reason') reason?: string,
  ) {
    return this.ownerService.rejectDriverDocuments(driverId, reason);
  }

  // Customer Booking
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('bookings')
  getAllBookings(@Query('page') page = 1, @Query('limit') limit = 10,) {
    return this.ownerService.getAllBookings(Number(page), Number(limit),);
  }

  // Trip Management (Driver-wise)
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('trips/management')
  getTripManagement(@Query('page') page = 1, @Query('limit') limit = 10,) {
    return this.ownerService.getTripManagement(Number(page), Number(limit),);
  }

  // All Withdrawal Request 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('/all-requests')
  getAllWithdrawals() {
    return this.ownerService.getAllWithdrawals();
  }

  // Approve withdrawal
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Patch(':id/approve-withdrawal')
  approveWithdrawal(@Param('id') withdrawalId: string) {
    return this.ownerService.approveWithdrawal(withdrawalId);
  }

  // Reject withdrawal
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Patch(':id/reject-withdrawal')
  rejectWithdrawal(@Param('id') withdrawalId: string) {
    return this.ownerService.rejectWithdrawal(withdrawalId);
  }

  // All Customers 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('all-customers')
  getCustomers(@Query('page') page = 1, @Query('limit') limit = 10,) {
    return this.ownerService.getAllCustomers(Number(page), Number(limit),);
  }

  // Ongiong Trips
  @Get('trips/ongoing')
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getOngoingTrips(@Query('page') page = 1, @Query('limit') limit = 10,) {
    return this.ownerService.getOngoingTrips(Number(page), Number(limit),);
  }

  // Admin Dashboard
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('dashboard')
  async getAdminDashboard() {
    return {
      message: 'Admin dashboard data fetched successfully',
      data: await this.ownerService.getAdminDashboard(),
    };
  }

  // Admin/Owner Proflie 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return this.ownerService.getProfile(req.owner.userId);
  }

  // Admin/Owner Update Proflie 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Put('profile/update')
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.ownerService.updateProfile(req.owner.userId, dto);
  }

  // Driver Payment Summary 
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('payments/drivers')
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getDriverPayments(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.ownerService.getDriverPaymentSummary(
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
      undefined,
      undefined,
      undefined,
      Number(page),
      Number(limit),
    );
  }

  // Driver Performance Report
  @Get('reports/driver-performance')
  @ApiQuery({ name: 'range', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getDriverPerformance(
    @Query('range') range?: string,
    @Query('driverName') driverName?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const { from, to } = getDateRange(range);
    return this.ownerService.getDriverPerformanceReport(
      {
        from: from?.toISOString(),
        to: to?.toISOString(),
        driverName,
      },
      Number(page),
      Number(limit),
    );
  }

  // Trip Report
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('reports/trips')
  @ApiQuery({ name: 'range', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getTripReport(
    @Query('range') range?: string,
    @Query('driverName') driverName?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const { from, to } = getDateRange(range);
    return this.ownerService.getTripReport(
      {
        from: from?.toISOString(),
        to: to?.toISOString(),
        driverName,
      },
      Number(page),
      Number(limit),
    );
  }

  // Cancellation Report
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @ApiQuery({ name: 'range', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getCancellationReport(
    @Query('range') range?: string,
    @Query('driverName') driverName?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const { from, to } = getDateRange(range);
    return this.ownerService.getCancellationReport(
      {
        from: from?.toISOString(),
        to: to?.toISOString(),
        driverName,
      },
      Number(page),
      Number(limit),
    );
  }

  // Earning Report
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('reports/earnings')
  @ApiQuery({ name: 'range', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getEarningsReport(
    @Query('range') range?: string,
    @Query('driverName') driverName?: string,
    @Query('page') page = 1, @Query('limit') limit = 10,) {
    const { from, to } = getDateRange(range);
    return this.ownerService.getDriverPaymentSummary(
      undefined,
      undefined,
      from,
      to,
      driverName,
      Number(page),
      Number(limit),
    );
  }

  // Payment Report
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('reports/payments')
  @ApiQuery({ name: 'range', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPaymentReport(
    @Query('range') range?: string,
    @Query('driverName') driverName?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const { from, to } = getDateRange(range);
    return this.ownerService.getPaymentReport(
      {
        from: from?.toISOString(),
        to: to?.toISOString(),
        driverName,
      },
      Number(page),
      Number(limit),
    );
  }

  // Export / Download Reports
  @ApiBearerAuth()
  @UseGuards(OwnerJwtGuard)
  @Get('reports/export')
  @ApiQuery({ name: 'report', enum: ReportType, required: false })
  @ApiQuery({ name: 'export', enum: ExportType, required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'driverName', required: false })
  async exportReports(
    @Query('report') report: ReportType,
    @Query('export') exportType: ExportType,
    @Res({ passthrough: false }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('driverName') driverName?: string,
  ) {
    let data: any[] = [];
    let title = '';

    const filters = { from, to, driverName };

    switch (report) {
      case ReportType.DRIVER_PERFORMANCE:
        data = await this.ownerService.getDriverPerformanceData(filters);
        title = 'Driver Performance Report';
        break;

      case ReportType.TRIPS:
        data = await this.ownerService.getTripReportData(filters);
        title = 'Trip Report';
        break;

      case ReportType.EARNINGS:
        data = await this.ownerService.getEarningsReportData(filters);
        title = 'Earnings Report';
        break;

      case ReportType.CANCELLATIONS:
        data = await this.ownerService.getCancellationReportData(filters);
        title = 'Cancellation Report';
        break;

      case ReportType.PAYMENTS:
        data = await this.ownerService.getPaymentReportData(filters);
        title = 'Payment Report';
        break;
    }

    const buffer = await this.reportExportService.export(
      report,
      exportType,
      data,
      title,
    );

    const extensionMap = {
      pdf: 'pdf',
      csv: 'csv',
      excel: 'xlsx',
    };

    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    res.setHeader('Content-Type', contentTypeMap[exportType]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${report}.${extensionMap[exportType]}`,
    );

    res.end(buffer);
  }
}

// Date Range Calculator 
function getDateRange(range?: string): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'TODAY': {
      return {
        from: startOfToday,
        to: new Date(),
      };
    }

    case 'LAST_7_DAYS': {
      const from = new Date();
      from.setDate(from.getDate() - 6); // including today
      from.setHours(0, 0, 0, 0);

      return {
        from,
        to: new Date(),
      };
    }

    case 'LAST_WEEK': {
      // Previous full calendar week (Mon–Sun)
      const day = now.getDay(); // 0 = Sunday
      const diffToMonday = day === 0 ? 6 : day - 1;

      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - diffToMonday - 7);
      lastMonday.setHours(0, 0, 0, 0);

      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);

      return {
        from: lastMonday,
        to: lastSunday,
      };
    }

    default:
      return {};
  }
}
