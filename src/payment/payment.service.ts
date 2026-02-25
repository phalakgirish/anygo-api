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

        // ✅ IMPORTANT: prevent duplicate payment
        if (booking.paymentStatus === PaymentStatus.SUCCESS) {
            throw new BadRequestException('Booking already paid');
        }

        // OPTIONAL: if order already exists and pending → reuse
        if (booking.razorpayOrderId && booking.paymentStatus === PaymentStatus.PENDING) {
            return {
                id: booking.razorpayOrderId,
                amount: booking.finalFare * 100,
                key: process.env.RAZORPAY_KEY_ID,
            };
        }

        const order = await this.razorpay.orders.create({
            amount: booking.finalFare * 100,
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
            key: process.env.RAZORPAY_KEY_ID,
        };
    }

    generateTestSignature(orderId: string, paymentId: string) {
        const body = orderId + "|" + paymentId;

        return crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(body)
            .digest("hex");
    }

    async verifyPayment(dto: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
    }) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

        // 1️⃣ Signature verification
        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            throw new BadRequestException('Invalid payment signature');
        }

        // 2️⃣ Fetch payment from Razorpay
        const payment = await this.razorpay.payments.fetch(
            razorpay_payment_id,
        );

        // ensure payment belongs to same order
        if (payment.order_id !== razorpay_order_id) {
            throw new BadRequestException('Order mismatch');
        }

        if (payment.status !== 'captured') {
            throw new BadRequestException(
                `Payment not captured. Status: ${payment.status}`,
            );
        }

        // 4️⃣ Find booking
        // 4️⃣ Find booking
        const booking = await this.bookingModel.findOne({
            razorpayOrderId: razorpay_order_id,
        });

        if (!booking) throw new BadRequestException('Booking not found');

        // ✅ already processed
        if (booking.paymentStatus === PaymentStatus.SUCCESS) {
            return { success: true };
        }

        // 5️⃣ Mark success
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.razorpaySignature = razorpay_signature;
        booking.paymentStatus = PaymentStatus.SUCCESS;

        await booking.save();

        return { success: true };
    }
}


// import { Injectable, BadRequestException } from '@nestjs/common';
// import Razorpay from 'razorpay';
// import * as crypto from 'crypto';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Booking } from 'src/customers/booking/schemas/booking.schema';
// import { PaymentStatus } from 'src/customers/booking/dto/payment-status.dto';

// @Injectable()
// export class PaymentService {
//     private razorpay: Razorpay;

//     constructor(
//         @InjectModel(Booking.name)
//         private bookingModel: Model<Booking>,
//     ) {
//         this.razorpay = new Razorpay({
//             key_id: process.env.RAZORPAY_KEY_ID!,
//             key_secret: process.env.RAZORPAY_KEY_SECRET!,
//         });
//     }

//     async createOrder(bookingId: string) {
//         const booking = await this.bookingModel.findById(bookingId);

//         if (!booking) throw new BadRequestException('Booking not found');
//         if (booking.finalFare == null)
//             throw new BadRequestException('Fare not finalized');

//         const order = await this.razorpay.orders.create({
//             amount: booking.finalFare * 100, // paise
//             currency: 'INR',
//             receipt: bookingId,
//         });

//         booking.razorpayOrderId = order.id;
//         booking.paymentMethod = 'ONLINE';
//         booking.paymentStatus = PaymentStatus.PENDING;

//         await booking.save();

//         return {
//             id: order.id,
//             amount: order.amount,
//             key: process.env.RAZORPAY_KEY_ID, // 👈 frontend needs this
//         };
//     }

//     generateTestSignature(orderId: string, paymentId: string) {
//         const body = orderId + "|" + paymentId;

//         return crypto
//             .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
//             .update(body)
//             .digest("hex");
//     }

//     // ✅ VERIFY PAYMENT
//     async verifyPayment(dto: {
//         razorpay_order_id: string;
//         razorpay_payment_id: string;
//         razorpay_signature: string;
//     }) {
//         const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

//         const body = razorpay_order_id + '|' + razorpay_payment_id;

//         const expectedSignature = crypto
//             .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
//             .update(body)
//             .digest('hex');

//         if (expectedSignature !== razorpay_signature) {
//             throw new BadRequestException('Invalid payment signature');
//         }

//         const booking = await this.bookingModel.findOne({
//             razorpayOrderId: razorpay_order_id,
//         });

//         if (!booking) {
//             throw new BadRequestException('Booking not found');
//         }

//         booking.razorpayPaymentId = razorpay_payment_id;
//         booking.razorpaySignature = razorpay_signature;
//         booking.paymentStatus = PaymentStatus.SUCCESS;

//         await booking.save();

//         return { success: true };
//     }
// }

