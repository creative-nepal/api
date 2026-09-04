import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsCoreModule } from './settings-core.module';

@Module({
  imports: [SettingsCoreModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
