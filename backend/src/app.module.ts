import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { BlockExplorerModule } from './api/block-explorer/block-explorer.module';
import { HealthModule } from './api/health/health.module';
import appConfiguration from './config/app.config';
import { DatabaseModule } from './config/database';
import { RequestMiddleware, SearchMiddleware } from './middlewares';
import { ScheduleModule } from '@nestjs/schedule';

const envConfig = () => {
  const option: ConfigModuleOptions = {
    isGlobal: true,
    load: [appConfiguration],
    cache: true, // env variables will be cached in the memory.
  };

  if (process.env.NODE_ENV === 'local') {
    option.envFilePath = [`.env.local`];
  }

  return option;
};

const MODULES = [
  ConfigModule.forRoot(envConfig()),
  DatabaseModule,
  ScheduleModule.forRoot(),
  HealthModule,
  BlockExplorerModule,
];

@Module({
  imports: [...MODULES],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestMiddleware)
      .exclude('/health')
      .forRoutes({ path: '*', method: RequestMethod.ALL })
      .apply(SearchMiddleware)
      .forRoutes({ path: '/search', method: RequestMethod.GET });
  }
}
