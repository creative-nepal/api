import { Exclude, Expose } from 'class-transformer';
import type { User } from '../../../database/schema';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  image: string | null;

  @Expose()
  createdAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.image = user.image;
    this.createdAt = user.createdAt;
  }
}
