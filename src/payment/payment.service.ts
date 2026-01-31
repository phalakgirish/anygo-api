import { Injectable, BadRequestException } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from 'src/customers/booking/schemas/booking.schema';
import { PaymentStatus } from 'src/customers/booking/dto/payment-status.dto';

@Injectable()
export class PaymentService {
    private razorpay: Razorpay;

    constructor(
        @InjectModel(Booking.name)
        private bookingModel: Model<Booking>,
    ) {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
    }

    async createOrder(bookingId: string) {
        const booking = await this.bookingModel.findById(bookingId);

        if (!booking) throw new BadRequestException('Booking not found');
        if (booking.finalFare == null)
            throw new BadRequestException('Fare not finalized');

        const order = await this.razorpay.orders.create({
            amount: booking.finalFare * 100, // paise
            currency: 'INR',
            receipt: bookingId,
        });

        booking.razorpayOrderId = order.id;
        booking.paymentMethod = 'ONLINE';
        booking.paymentStatus = PaymentStatus.PENDING;

        await booking.save();

        return {
            id: order.id,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID, // 👈 frontend needs this
        };
    }


    // ✅ VERIFY PAYMENT
    async verifyPayment(dto: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
    }) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            throw new BadRequestException('Invalid payment signature');
        }

        const booking = await this.bookingModel.findOne({
            razorpayOrderId: razorpay_order_id,
        });

        if (!booking) {
            throw new BadRequestException('Booking not found');
        }

        booking.razorpayPaymentId = razorpay_payment_id;
        booking.razorpaySignature = razorpay_signature;
        booking.paymentStatus = PaymentStatus.SUCCESS;

        await booking.save();

        return { success: true };
    }
}
