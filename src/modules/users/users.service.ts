import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../database/schema';
import { UsersRepository } from './users.repository';

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

  async list(limit: number, offset: number): Promise<User[]> {
    return this.usersRepository.findMany(limit, offset);
  }

  async updateName(id: string, name: string): Promise<User> {
    const updated = await this.usersRepository.updateName(id, name);

    if (!updated) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return updated;
  }
}
