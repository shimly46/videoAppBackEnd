import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/bad-request.filter';
import { ErrorFilter } from './filters/exception.filter';
import { QueryFailedFilter } from './filters/query-failed.filter';
import { ConfigService } from './shared/services/config/config.service';
import { SharedModule } from './shared/shared.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
    { cors: true },
  );

  app.enableCors();
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const reflector = app.get(Reflector);

  app.useGlobalFilters(
    new HttpExceptionFilter(reflector),
    new QueryFailedFilter(reflector),
    new ErrorFilter(reflector)
  );

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      dismissDefaultMessages: false,
      validationError: {
        target: false,
      },
    }),
  );

  const configService = app.select(SharedModule).get(ConfigService);

  app.connectMicroservice({
    transport: 0,
    options: {
      port: configService.getNumber('TRANSPORT_PORT'),
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });
  await app.startAllMicroservices();


  const port = configService.getNumber('PORT');
  await app.listen(port);
  console.info(`server running on port ${port}`);
}
bootstrap();

