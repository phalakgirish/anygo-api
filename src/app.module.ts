import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OwnerModule } from './owner/owner.module';
import { CustomersModule } from './customers/customers.module';
import { DriversModule } from './drivers/drivers.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { GatewaysModule } from './gateways/gateways.module';
import { MasterModule } from './master/master.module';

@Module({
  imports: [ MongooseModule.forRoot('mongodb+srv://anygoUser:BOJkZdLjG5Q5Z6pR@anygo.qwztb8w.mongodb.net/Anygo'),OwnerModule, CustomersModule, 
  DriversModule, AuthModule, CommonModule,MasterModule, 
  ConfigModule.forRoot({ isGlobal: true,}),GatewaysModule,],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
