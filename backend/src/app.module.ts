import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConfigModule } from './config/config.module';
import { AwsModule } from './aws/aws.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [ConfigModule, AwsModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
