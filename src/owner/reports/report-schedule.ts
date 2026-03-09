import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../../common/mail/mail.service';
import { ReportService } from './report.service';

@Injectable()
export class ReportSchedule {

  constructor(
    private reportService: ReportService,
    private mailService: MailService
  ){}

  @Cron('0 59 23 * * *')
  async sendDailyReport() {

    const stats = await this.reportService.getDailyReportData();
    const pdf = await this.reportService.generateDailyPDF();

    const adminEmail = process.env.MAIL_USER || 'yourcompany@gmail.com@company.com';


    const date = new Date().toLocaleDateString('en-IN', {
      day:'numeric',
      month:'long',
      year:'numeric'
    });

    const html = `
<pre>
DAILY REPORT
Date: ${date}

--------------------------------

TRIPS
Total Trips: ${stats.totalTrips}
Completed: ${stats.completedTrips}
Cancelled: ${stats.cancelledTrips}
Ongoing: ${stats.ongoingTrips}

Success Rate: ${stats.successRate}%

--------------------------------

REVENUE
Total Revenue: ₹${stats.totalRevenue}
Average Fare: ₹${stats.averageFare}
Highest Fare: ₹${stats.highestFare}
Lowest Fare: ₹${stats.lowestFare}

--------------------------------

CUSTOMERS
New Customers: ${stats.newCustomers}
Customers Who Booked: ${stats.customersBooked}
Total Customers: ${stats.totalCustomers}

--------------------------------

DRIVERS
Total Drivers: ${stats.totalDrivers}
Active Today: ${stats.activeDrivers}
Completed Trips: ${stats.driversCompletedTrips}

--------------------------------

PAYMENTS
Online Payments: ${stats.onlinePayments}
Cash Payments: ${stats.cashPayments}
Pending Payments: ${stats.pendingPayments}

--------------------------------

Generated Automatically
AnyGO Mobility and Global Services
</pre>
`;

    await this.mailService.sendMailWithAttachment(
      adminEmail,
      'Daily Report',
      html,
      [
        {
          filename: 'daily-report.pdf',
          content: pdf
        }
      ]
    );
  }
}