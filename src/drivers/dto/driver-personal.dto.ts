import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsMobilePhone, MinLength, IsBoolean, ValidationOptions, registerDecorator } from 'class-validator';

// export function IsTrue(validationOptions?: ValidationOptions) {
// return function (object: Object, propertyName: string) {
//  registerDecorator({
//    name: 'isTrue',
//    target: object.constructor,
//    propertyName: propertyName,
//    options: validationOptions,
//    validator: {
//      validate(value: any) {
//        return value === true;
//      },
//      defaultMessage(): string {
//        return 'You must accept terms and conditions';
//      },
//    },
//  });
//  };
// }

export class DriverPersonalDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsMobilePhone("en-IN")
  mobile: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsMobilePhone("en-IN")
  emergencyMobile: string;

  @ApiProperty()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  city: string;  

  // @ApiProperty({ description: 'Driver must accept terms', example: true })
  // @IsNotEmpty()
  // @IsBoolean()
  // @IsTrue({ message: 'You must accept terms and conditions' })
  // acceptedTerms: boolean;
}
