import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../database/schema';
import { type FindUsersOptions, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getById(id: string): Promise<User> {
    const found = await this.usersRepository.findById(id);

    if (!found) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return found;
  }

  async list(
    options: FindUsersOptions,
  ): Promise<{ rows: User[]; total: number }> {
    return this.usersRepository.findMany(options);
  }

  async updateName(id: string, name: string): Promise<User> {
    const updated = await this.usersRepository.updateName(id, name);

    if (!updated) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return updated;
  }
}
