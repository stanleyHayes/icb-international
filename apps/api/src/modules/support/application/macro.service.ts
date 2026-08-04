import type { SupportMessage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { renderMacro } from '../domain/macro.js';
import { toMacroView } from '../infrastructure/support.mapper.js';
import type {
  macroCreateRequestSchema,
  macroUpdateRequestSchema,
  MacroView,
} from '../infrastructure/support-requests.js';
import { SupportMacroDoc } from '../infrastructure/support.schemas.js';
import { InboxService } from './inbox.service.js';

export type MacroCreateInput = z.infer<typeof macroCreateRequestSchema>;
export type MacroUpdateInput = z.infer<typeof macroUpdateRequestSchema>;

/**
 * Saved replies. CRUD is ordinary; the interesting operation is `apply`, which renders the
 * template against the ticket and posts the result as the agent's reply in one action — a macro
 * that only copies text to a clipboard would still let an agent send it to the wrong customer.
 */
@Injectable()
export class MacroService {
  constructor(
    @InjectModel(SupportMacroDoc.name) private readonly macros: Model<SupportMacroDoc>,
    private readonly inbox: InboxService,
    private readonly clock: ClockService,
  ) {}

  async list(): Promise<MacroView[]> {
    const rows = await this.macros.find().sort({ category: 1, name: 1 }).lean();
    return rows.map(toMacroView);
  }

  async create(staff: AccessTokenClaims, request: MacroCreateInput): Promise<MacroView> {
    const now = this.clock.now();
    try {
      const [macro] = await this.macros.create([
        { ...request, usageCount: 0, createdBy: staff.sub, createdAt: now, updatedAt: now },
      ]);
      return toMacroView(macro as SupportMacroDoc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('A macro with this name already exists', { name: request.name });
      }
      throw error;
    }
  }

  async update(macroId: string, request: MacroUpdateInput): Promise<MacroView> {
    const set: Record<string, unknown> = { updatedAt: this.clock.now() };
    if (request.name !== undefined) {
      set['name'] = request.name;
    }
    if (request.category !== undefined) {
      set['category'] = request.category;
    }
    if (request.body !== undefined) {
      set['body'] = request.body;
    }

    try {
      const updated = await this.macros
        .findOneAndUpdate({ _id: macroId }, { $set: set }, { new: true })
        .lean();
      if (!updated) {
        throw new NotFoundError('Macro', macroId);
      }
      return toMacroView(updated);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('A macro with this name already exists', { name: request.name });
      }
      throw error;
    }
  }

  async remove(macroId: string): Promise<void> {
    const result = await this.macros.deleteOne({ _id: macroId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Macro', macroId);
    }
  }

  /** Render against the ticket, post as the agent, count the use. */
  async apply(
    macroId: string,
    ticketId: string,
    staff: AccessTokenClaims,
  ): Promise<SupportMessage> {
    const macro = await this.macros.findById(macroId).lean();
    if (!macro) {
      throw new NotFoundError('Macro', macroId);
    }
    const ticket = await this.inbox.loadTicket(ticketId);

    const body = renderMacro(macro.body, {
      customerName: ticket.customerName,
      ticketReference: ticket.reference,
      agentName: await this.inbox.displayNameFor(staff),
    });

    const message = await this.inbox.reply(ticketId, staff, {
      body,
      attachments: [],
      resolve: false,
    });
    await this.macros.updateOne({ _id: macroId }, { $inc: { usageCount: 1 } });
    return message;
  }
}
