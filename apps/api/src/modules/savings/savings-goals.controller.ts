import {
  contributeToGoalRequestSchema,
  createSavingsGoalRequestSchema,
  updateSavingsGoalRequestSchema,
  type CreateSavingsGoalRequest,
  type SavingsGoal,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import {
  SavingsGoalsService,
  type ContributeToGoalRequest,
  type UpdateSavingsGoalRequest,
} from './savings-goals.service.js';

/**
 * Savings goals.
 *
 * Every handler derives the customer from the verified token; the path only ever says *which*
 * goal, never *whose*. A goal id belonging to someone else therefore returns a 404 rather than
 * their savings.
 */
@Controller('savings/goals')
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: SavingsGoal[] }> {
    return { items: await this.goals.list(customerId) };
  }

  @Post()
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createSavingsGoalRequestSchema)) body: CreateSavingsGoalRequest,
  ): Promise<SavingsGoal> {
    return this.goals.create(customerId, body);
  }

  @Get(':goalId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('goalId') goalId: string,
  ): Promise<SavingsGoal> {
    return this.goals.get(customerId, goalId);
  }

  @Patch(':goalId')
  async update(
    @CurrentCustomer() customerId: string,
    @Param('goalId') goalId: string,
    @Body(zodBody(updateSavingsGoalRequestSchema)) body: UpdateSavingsGoalRequest,
  ): Promise<SavingsGoal> {
    return this.goals.update(customerId, goalId, body);
  }

  @Delete(':goalId')
  @HttpCode(204)
  async remove(
    @CurrentCustomer() customerId: string,
    @Param('goalId') goalId: string,
  ): Promise<void> {
    await this.goals.remove(customerId, goalId);
  }

  /** Moves real money: the funding account is debited and the goal's account credited. */
  @Post(':goalId/contribute')
  @Idempotent()
  async contribute(
    @CurrentCustomer() customerId: string,
    @Param('goalId') goalId: string,
    @Body(zodBody(contributeToGoalRequestSchema)) body: ContributeToGoalRequest,
  ): Promise<SavingsGoal> {
    return this.goals.contribute(customerId, goalId, body);
  }
}
