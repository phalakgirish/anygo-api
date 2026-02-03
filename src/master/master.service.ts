import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from './schemas/city.schema';
import { Vehicle, VehicleDocument } from './schemas/vehicle.schema';
import { Pricing, PricingDocument } from '../customers/booking/schemas/pricing.schema';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreatePricingDto } from './dto/create-pricing.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';

@Injectable()
export class MasterService {
    constructor(
        @InjectModel(City.name) private cityModel: Model<CityDocument>,
        @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
        @InjectModel(Pricing.name) private pricingModel: Model<PricingDocument>,
    ) { }

    // ───────────── CITY ─────────────

    async createCity(dto: CreateCityDto) {
        const exists = await this.cityModel.findOne({ name: dto.name });
        if (exists) throw new BadRequestException('City already exists');

        return this.cityModel.create({ name: dto.name });
    }

    async getCities(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.cityModel
                .find({ isActive: true })
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit),
            this.cityModel.countDocuments({ isActive: true }),
        ]);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }


    async updateCity(id: string, dto: UpdateCityDto) {
        const city = await this.cityModel.findByIdAndUpdate(id, dto, { new: true });
        if (!city) throw new NotFoundException('City not found');
        return city;
    }

    async deleteCity(id: string) {
        const city = await this.cityModel.findById(id);
        if (!city) throw new NotFoundException('City not found');

        city.isActive = false;
        await city.save();

        return {
            message: 'City disabled successfully',
        };
    }

    // ───────────── VEHICLE ─────────────

    async createVehicle(dto: CreateVehicleDto) {
        const exists = await this.vehicleModel.findOne({
            name: dto.vehicleType,
        });

        if (exists) throw new BadRequestException('Vehicle already exists');

        return this.vehicleModel.create(dto);
    }

    async getVehicles(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.vehicleModel
                .find({ isActive: true })
                .sort({ vehicleType: 1 })
                .skip(skip)
                .limit(limit),
            this.vehicleModel.countDocuments({ isActive: true }),
        ]);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }


    async updateVehicle(id: string, dto: UpdateVehicleDto) {
        const vehicle = await this.vehicleModel.findByIdAndUpdate(id, dto, { new: true });
        if (!vehicle) throw new NotFoundException('Vehicle not found');
        return vehicle;
    }

    async deleteVehicle(id: string) {
        const vehicle = await this.vehicleModel.findById(id);
        if (!vehicle) throw new NotFoundException('Vehicle not found');

        vehicle.isActive = false;
        await vehicle.save();

        return {
            message: 'Vehicle disabled successfully',
        };
    }

    // ───────────── PRICING ─────────────

    async createPricing(dto: CreatePricingDto) {
        const exists = await this.pricingModel.findOne({
            vehicleType: dto.vehicleType,
        });

        if (exists) throw new BadRequestException('Pricing already exists');

        return this.pricingModel.create(dto);
    }

    async getPricing(
        vehicleType?: string,
        page = 1,
        limit = 10,
    ) {
        const filter: any = { isActive: true };

        if (vehicleType) {
            filter.vehicleType = vehicleType;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.pricingModel
                .find(filter)
                .sort({ vehicleType: 1 })
                .skip(skip)
                .limit(limit),
            this.pricingModel.countDocuments(filter),
        ]);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }


    async updatePricing(id: string, dto: UpdatePricingDto) {
        const pricing = await this.pricingModel.findByIdAndUpdate(id, dto, { new: true });
        if (!pricing) throw new NotFoundException('Pricing not found');
        return pricing;
    }

    async deletePricing(id: string) {
        const pricing = await this.pricingModel.findById(id);
        if (!pricing) throw new NotFoundException('Pricing not found');

        pricing.isActive = false;
        await pricing.save();

        return {
            message: 'Pricing disabled successfully',
        };
    }
}
