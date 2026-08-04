import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  ContentLocationView,
  LocationCreateRequest,
  LocationUpdateRequest,
} from '@icb/contracts';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { toLocationView } from '../infrastructure/content.mapper.js';
import { ContentLocationDoc } from '../infrastructure/content.schemas.js';

/**
 * Branch and ATM records.
 *
 * Plain CRUD; the only split is audience — staff manage every record including retired sites,
 * the public site lists active ones. `nullish` coordinates arrive as `null` so the document
 * always carries the field and the mapper never guesses.
 */
@Injectable()
export class LocationService {
  constructor(
    @InjectModel(ContentLocationDoc.name) private readonly locations: Model<ContentLocationDoc>,
    private readonly clock: ClockService,
  ) {}

  async listAll(): Promise<ContentLocationView[]> {
    const rows = await this.locations.find().sort({ type: 1, name: 1 }).lean();
    return rows.map(toLocationView);
  }

  async listActive(): Promise<ContentLocationView[]> {
    const rows = await this.locations.find({ active: true }).sort({ type: 1, name: 1 }).lean();
    return rows.map(toLocationView);
  }

  async create(request: LocationCreateRequest): Promise<ContentLocationView> {
    const now = this.clock.now();
    const [location] = await this.locations.create([
      {
        name: request.name,
        type: request.type,
        address: {
          line1: request.address.line1,
          line2: request.address.line2 ?? null,
          city: request.address.city,
          region: request.address.region ?? null,
          postalCode: request.address.postalCode ?? null,
          country: request.address.country,
        },
        latitude: request.latitude ?? null,
        longitude: request.longitude ?? null,
        hours: request.hours,
        services: request.services,
        active: request.active,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    return toLocationView(location as ContentLocationDoc);
  }

  async update(locationId: string, request: LocationUpdateRequest): Promise<ContentLocationView> {
    const updated = await this.locations
      .findOneAndUpdate(
        { _id: locationId },
        { $set: { ...request, updatedAt: this.clock.now() } },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundError('Location', locationId);
    }
    return toLocationView(updated);
  }

  async remove(locationId: string): Promise<void> {
    const result = await this.locations.deleteOne({ _id: locationId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Location', locationId);
    }
  }
}
