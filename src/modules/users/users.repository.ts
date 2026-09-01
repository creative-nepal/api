import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { User } from '../../database/schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1);
    return row;
  }

  async findMany(limit: number, offset: number): Promise<User[]> {
    return this.db.select().from(schema.user).limit(limit).offset(offset);
  }

  async updateName(id: string, name: string): Promise<User | undefined> {
    const [row] = await this.db
      .update(schema.user)
      .set({ name })
      .where(eq(schema.user.id, id))
      .returning();
    return row;
  }
}
