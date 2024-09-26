import {
  Controller,
  Get,
  Req,
  Body,
  Patch,
  Post,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Request,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { DatabaseService } from "../database/database.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { StorageService } from "src/storage/storage.service";

import { DepositsService } from "./deposits.service";
import { UsersService } from "src/users/users.service";

@UseGuards(AuthGuard)
@Controller("deposits")
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly userSerice: UsersService
  ) {}

  @Get()
  findDeposits(
    @Req() req,
    @Query("category") category: string,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined,
    @Query("scope") scope: string | undefined,
    @Query("status") status: string | undefined
  ) {
    if (scope === "all") {
      if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
        if (req.user.role === "Agent") {
          return this.userSerice.findAssignments(
            req.user.id,
            "Deposit",
            parseInt(limit ?? "10"),
            parseInt(skip ?? "0")
          );
        }

        throw new BadRequestException("Unauthorized");
      }

      return this.depositsService.fetchAll(
        category,
        parseInt(limit ?? "10"),
        parseInt(skip ?? "0"),
        status
      );
    }

    return this.depositsService.findDepositsByUserId(
      req.user.id,
      category,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0"),
      status
    );
  }

  @Post("apply")
  async applyForDeposit(@Req() req, @Body() body) {
    if (!req.user.ac_status) {
      throw new BadRequestException("your account is not active.");
    }

    if (!req.user.kyc_verified) {
      throw new BadRequestException("Please get your KYC verified.");
    }

    try {
      return this.depositsService.applyForDeposit(
        req.user.id,
        body.deposit_data
      );
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Post(":id/reapply")
  async reapplyForDeposit(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    if (!req.user.ac_status) {
      throw new BadRequestException("your account is not active.");
    }

    if (!req.user.kyc_verified) {
      throw new BadRequestException("Please get your KYC verified.");
    }

    try {
      return this.depositsService.reapplyDepositByDepositId(req.user.id, id, {
        ...body,
      });
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Get(":id")
  async findDeposit(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.depositsService.findUserDepositById(req.user.id, id);
  }

  @Get(":id/due")
  async getDepositDue(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.depositsService.findUserDeopsitDueById(req.user.id, id);
  }

  @Get(":id/repayments")
  async findUserDeppositRepaymentsById(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Query("limit", ParseIntPipe) limit: string | undefined,
    @Query("skip", ParseIntPipe) skip: string | undefined
  ) {
    return this.depositsService.findUserDepositRepaymentsById(
      req.user.id,
      id,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0")
    );
  }

  @Get(":id/agents")
  async findAssignedAgents(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Query("agent_id") agent_id: string | undefined
  ) {
    return this.depositsService.findAssignedAgentsByDepositId(id, agent_id);
  }

  @Post(":id/approve")
  async approve(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.depositsService.approveDepositById(req.user.id, id);
  }

  @Post(":id/reject")
  async reject(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.depositsService.rejectDepositByID(id, body.remark);
  }

  @Post(":id/assign-agent")
  async assignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.depositsService.assignAgent(id, body.agent_id);
  }

  @Post(":id/unassign-agent")
  async unassignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.depositsService.unassignAgent(id, body.agent_id);
  }

  @Post(":id/collect")
  async collectRepayment(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.depositsService.collectRepayment(req, id, body.emi_data);
  }

  @Post(":id/settle")
  async settlement(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.depositsService.settlement(req.user.id, id, body.settle_data);
  }

  @Post(":id/update-referrer")
  async updateReferrer(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.depositsService.updateReferrer(id, body.ref_id);
  }
}
