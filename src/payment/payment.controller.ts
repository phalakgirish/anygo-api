import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
// import { JwtAuthGuard } from 'src/auth/jwt-auth/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  // @UseGuards(JwtAuthGuard)
  @Post('create-order/:bookingId')
  createOrder(@Param('bookingId') bookingId: string) {
    return this.paymentService.createOrder(bookingId);
  }

  @Post("test-signature")
  testSig(@Body() body: any) {
    return {
      signature: this.paymentService.generateTestSignature(
        body.orderId,
        body.paymentId
      ),
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Post('verify')
  verifyPayment(@Body() body: any) {
    return this.paymentService.verifyPayment(body);
  }
}
