import { Module } from '@nestjs/common';

import { assetStoreProvider } from '../documents/infrastructure/asset-store.provider.js';
import {
  LocalDeliveryService,
  localMediaRootProvider,
} from './application/local-delivery.service.js';
import { LocalUploadService } from './application/local-upload.service.js';
import { LocalDeliveryController } from './local-delivery.controller.js';
import { LocalUploadController } from './local-upload.controller.js';

/**
 * The media surface that only exists without storage credentials: the local upload endpoint the
 * KYC and support signature minters point at in a keyless checkout, and the delivery endpoint
 * the local store's signed links point at. The asset store provider is bound here (not imported
 * from DocumentsModule) so this module answers uploads without taking a dependency on statement
 * generation.
 */
@Module({
  controllers: [LocalUploadController, LocalDeliveryController],
  providers: [assetStoreProvider, localMediaRootProvider, LocalUploadService, LocalDeliveryService],
})
export class MediaModule {}
