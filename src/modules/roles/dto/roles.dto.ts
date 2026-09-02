import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'role must be a lowercase slug',
  })
  role!: string;

  @IsObject()
  permission!: Record<string, unknown>;
}

export class UpdateRoleDto {
  @IsOptional() @IsObject() permission?: Record<string, unknown>;
}
