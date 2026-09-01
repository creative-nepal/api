import { Inject } from '@nestjs/common';
import { DRIZZLE } from './database.constants';

export const InjectDatabase = () => Inject(DRIZZLE);
