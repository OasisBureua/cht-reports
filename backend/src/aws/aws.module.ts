import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AwsClients } from './aws-clients';

@Module({
  imports: [ConfigModule],
  providers: [AwsClients],
  exports: [AwsClients],
})
export class AwsModule {}