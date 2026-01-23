import { ApiProperty } from '@nestjs/swagger';
import {IsEmail,IsNotEmpty,IsString,IsMobilePhone,MinLength,MaxLength,IsBoolean} from 'class-validator';


import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsTrue(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isTrue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return value === true;
        },
        defaultMessage(): string {
          return 'You must accept terms and conditions';
        },
      },
    });
  };
}

export class CreateCustomerDto {
  @ApiProperty({
    description: 'First Name',
    example: 'Girish',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last Name',
    example: 'Phalak',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  lastName: string;

   @ApiProperty({
    description: 'Mobile Number',
    example: '8879679180',
    required: true,
  })
  @IsNotEmpty()
  @IsMobilePhone('en-IN', { strictMode: false }, { message: 'Invalid Indian mobile number' })
  mobile: string;

  @ApiProperty({
    description: 'Email Id',
    example: 'shital@psoftsolutions.in',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  // Password may be optional for multi-step registration; required here for single-step
    @ApiProperty({
    description: 'Password',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  password: string;

  @ApiProperty({ description: 'Customer must accept terms', example: true })
  @IsNotEmpty()
  @IsBoolean()
  @IsTrue({ message: 'You must accept terms and conditions' })
  acceptedTerms: boolean;
}
