import type { DownloadLink } from '@icb/contracts';
import { PDF_MIME_TYPE, type AssetStore } from '@icb/media';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newReference } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { ASSET_STORE } from '../documents/infrastructure/asset-store.provider.js';
import { renderExportPdf } from './domain/export-pdf.js';
import { EXPORT_FILENAME, EXPORT_LABEL } from './customers.constants.js';
import { buildFootprint } from './infrastructure/export-footprint.js';
import { ExportSourceReader } from './infrastructure/export-source.reader.js';

/**
 * GDPR-style data export.
 *
 * Assembles the customer's full footprint — identity, addresses, preferences, verification
 * state, status history, accounts, and sign-in devices — renders it as a PDF, stores it in the
 * customer's own asset folder, and answers with a signed link that expires on its own. The
 * export is generated on every request rather than archived: data this fresh is stale the
 * moment it is filed, and a durable copy in the archive would be one more copy to protect.
 */
@Injectable()
export class CustomerExportService {
  private readonly logger = new Logger(CustomerExportService.name);

  constructor(
    private readonly sources: ExportSourceReader,
    @Inject(ASSET_STORE) private readonly assets: AssetStore,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async exportData(customerId: string): Promise<DownloadLink> {
    const now = this.clock.now();
    const reference = newReference('EXP');
    const input = await this.sources.gather(customerId, now, reference);

    const pdf = renderExportPdf(buildFootprint(input), this.config.bank.name, now);
    const asset = await this.assets.upload({
      kind: 'statements',
      ownerId: customerId,
      contentType: PDF_MIME_TYPE,
      bytes: pdf,
      label: EXPORT_LABEL,
      originalFilename: EXPORT_FILENAME,
    });

    this.logger.log({ customerId, reference }, 'Data export generated');
    const delivery = this.assets.buildSignedUrl(asset, undefined, { download: true });
    return { url: delivery.url, expiresAt: delivery.expiresAt, filename: EXPORT_FILENAME };
  }
}
