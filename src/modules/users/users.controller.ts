import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UserResponseDto> {
    const found = await this.usersService.getById(currentUser.id);
    return new UserResponseDto(found);
  }

  @Get()
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const { rows, total } = await this.usersService.list(query);

    return {
      data: rows.map((user) => new UserResponseDto(user)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<UserResponseDto> {
    const found = await this.usersService.getById(id);
    return new UserResponseDto(found);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateName(
      currentUser.id,
      dto.name,
    );
    return new UserResponseDto(updated);
  }
}
