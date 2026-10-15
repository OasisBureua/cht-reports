import { Module } from '@nestjs/common';
import { AppEnv, loadEnv } from './env';

export const APP_ENV = Symbol('APP_ENV');

@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: (): AppEnv => loadEnv(),
    },
  ],
  exports: [APP_ENV],
})
export class ConfigModule {}
