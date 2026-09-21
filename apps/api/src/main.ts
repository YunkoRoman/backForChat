import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ConfigService } from './config/config.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  // Get config service for CORS origin
  const configService = app.get(ConfigService);

  // Enable CORS with credentials support for cookies
  app.enableCors({
    origin: configService.frontendOrigin,
    credentials: true,
  });

  // Apply helmet middleware for security headers
  app.use(helmet());

  // Register cookie parser middleware
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
