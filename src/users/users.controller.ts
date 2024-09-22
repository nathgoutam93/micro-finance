import {
  Controller,
  Get,
  Body,
  Patch,
  Post,
  Req,
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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { DatabaseService } from '../database/database.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from 'src/storage/storage.service';

import * as CryptoJS from 'crypto-js';

import { formateId } from 'src/utils/formateId';

@UseGuards(AuthGuard)
@Controller('user')
export class UsersController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  hash(password: string): string {
    const hashedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.SALT as string,
    ).toString();

    return hashedPassword;
  }

  compareHash(plainTextPassword: string, hashedPassword: string): boolean {
    const decrypted_pass = CryptoJS.AES.decrypt(
      hashedPassword,
      process.env.SALT as string,
    ).toString(CryptoJS.enc.Utf8);

    return plainTextPassword === decrypted_pass;
  }

  @Get('profile')
  async profile(@Req() req) {
    return this.usersService.findOneById(req.user.id);
  }

  @Post('profile/update')
  updateProfile(@Req() req, @Body() userUpdateInput: Prisma.userUpdateInput) {
    if (req.user.ac_status) {
      throw new BadRequestException(
        "Can't make any changes, after account has been approved.",
      );
    }

    return this.usersService.update(req.user.id, userUpdateInput);
  }

  @Post('profile/update-dp')
  @UseInterceptors(FileInterceptor('profile_img'))
  async updateProfilePic(
    @Req() req,
    @UploadedFile() profile_img: Express.Multer.File,
  ) {
    if (req.user.ac_status) {
      throw new BadRequestException(
        "Can't make any changes, after account has been approved.",
      );
    }

    console.log(profile_img);

    try {
      const image_url = await this.storageService.upload(
        profile_img.originalname,
        profile_img.buffer,
      );

      return this.usersService.updateProfilePic(req.user.id, image_url);
    } catch (error) {
      return { error: 'Failed to upload file', details: error.message };
    }
  }

  @Post('settings/change-pass')
  async changePassword(@Req() req, @Body() body) {
    if (body.new_pass !== body.confirm) {
      throw new BadRequestException('Password did not matched!');
    }

    if (body.new_pass.length < 6) {
      throw new BadRequestException('Password must be atleast 6 char long!');
    }

    const user = await this.databaseService.user.findFirst({
      where: {
        id: req.user.id,
      },
    });

    const hashedPassword = this.hash(body.new_pass as string);

    if (!this.compareHash(body.old_pass, user.password)) {
      throw new BadRequestException('Old Password did not matched!');
    }

    await this.databaseService.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      status: true,
      message: 'Password has been changed Successfully.',
    };
  }

  @Get('referrals')
  async referrals(@Req() req) {
    const deposits = await this.databaseService.deposits.aggregate({
      _sum: {
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        ref_id: req.user.id,
        deposit_status: 'Active',
      },
    });

    const loans = await this.databaseService.loans.aggregate({
      _sum: {
        amount: true,
      },
      _count: {
        amount: true,
      },
      where: {
        ref_id: req.user.id,
        loan_status: 'Active',
      },
    });

    const deposit_refs = await this.databaseService.deposits.findMany({
      where: {
        ref_id: req.user.id,
        deposit_status: 'Active',
      },
      select: {
        id: true,
        total_paid: true,
        amount: true,
        category: true,
      },
    });

    const loan_refs = await this.databaseService.loans.findMany({
      where: {
        ref_id: req.user.id,
        loan_status: 'Active',
      },
      select: {
        id: true,
        total_paid: true,
        total_payable: true,
      },
    });

    const referrals: {
      id: string;
      amount: number;
      category: 'Loan' | 'Deposit';
    }[] = [];

    loan_refs.map((loan) => {
      referrals.push({
        id: formateId(loan.id, 'Loan'),
        amount: Number(loan.total_payable) - Number(loan.total_paid),
        category: 'Loan',
      });
    });

    deposit_refs.map((deposit) => {
      referrals.push({
        id: formateId(deposit.id, deposit.category as 'RD' | 'FD'),
        amount: Number(deposit.total_paid),
        category: 'Deposit',
      });
    });

    return {
      status: true,
      data: {
        deposits: {
          count: deposits._count.amount,
          amount: Number(deposits._sum.total_paid),
        },
        loans: {
          count: loans._count.amount,
          amount: Number(loans._sum.amount),
        },
        referrals,
      },
    };
  }

  @Get('dash-data')
  async dashData(@Req() req) {
    if (!['Admin', 'Manager'].includes(req.user.role ?? '')) {
      const deposits = await this.databaseService.deposits.aggregate({
        _sum: {
          total_paid: true,
        },
        _count: {
          amount: true,
        },
        where: {
          user_id: req.user.id,
          deposit_status: 'Active',
        },
      });

      const loans = await this.databaseService.loans.aggregate({
        _sum: {
          total_paid: true,
          total_payable: true,
        },
        _count: {
          amount: true,
        },
        where: {
          user_id: req.user.id,
          loan_status: 'Active',
        },
      });

      // const deposit_due = await this.databaseService.due_record.findMany({
      //   orderBy: {
      //     "due_date": "asc"
      //   },
      //   where: {
      //     category: "Deposit",
      //     status: "Due"
      //   },
      //   take: 1,
      // });

      // const loan_due = await this.databaseService.due_record.findMany({
      //   orderBy: {
      //     due_date: "asc",
      //   },
      //   where: {

      //   },
      //   take: 1,
      // });

      let emi_due = null;

      return {
        status: true,
        message: {
          deposits: {
            count: deposits._count.amount,
            amount: deposits._sum.total_paid,
          },
          loans: {
            count: loans._count.amount,
            amount:
              Number(loans._sum.total_payable) - Number(loans._sum.total_paid),
          },
          emi: emi_due,
        },
      };
    }

    const deposits = await this.databaseService.deposits.aggregate({
      _sum: {
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        deposit_status: 'Active',
      },
    });

    const deposit_paid_today = await this.databaseService.emi_records.aggregate(
      {
        where: {
          category: 'Deposit',
          OR: [
            {
              status: 'Paid',
            },
            {
              status: 'Collected',
            },
            {
              status: 'Hold',
            },
          ],
          created_at: {
            gte: new Date(new Date(new Date().setHours(0))),
            lte: new Date(new Date(new Date().setHours(24))),
          },
        },
        _sum: {
          amount: true,
        },
      },
    );

    const loans = await this.databaseService.loans.aggregate({
      _sum: {
        total_payable: true,
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        loan_status: 'Active',
      },
    });

    const loan_paid_today = await this.databaseService.emi_records.aggregate({
      where: {
        category: 'Loan',
        OR: [
          {
            status: 'Paid',
          },
          {
            status: 'Collected',
          },
          {
            status: 'Hold',
          },
        ],
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        amount: true,
      },
    });

    const loan_due_today = await this.databaseService.due_record.aggregate({
      where: {
        category: 'Loan',
        status: 'Due',
        due_date: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        emi_amount: true,
      },
    });

    const deposit_due_today = await this.databaseService.due_record.aggregate({
      where: {
        category: 'Deposit',
        status: 'Due',
        due_date: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        emi_amount: true,
      },
    });

    const today_incoming = await this.databaseService.emi_records.aggregate({
      where: {
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        amount: true,
      },
    });

    const today_disburshed = await this.databaseService.transactions.aggregate({
      where: {
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
        txn_type: {
          in: [
            'Disburshed',
            'MatureClosed',
            'PrematureClosed',
            'ApprovedWithdrawal',
          ],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const balance = await this.databaseService.wallets.aggregate({
      where: {
        owner: {
          role: {
            in: ['Admin', 'Manager'],
          },
        },
      },
      _sum: {
        balance: true,
      },
    });

    return {
      status: true,
      message: {
        deposits: {
          count: deposits._count.amount,
          amount: deposits._sum.total_paid,
          today: {
            paid: Number(deposit_paid_today._sum.amount),
            due: Number(deposit_due_today._sum.emi_amount),
          },
        },
        loans: {
          count: loans._count.amount,
          amount:
            Number(loans._sum.total_payable) - Number(loans._sum.total_paid),
          today: {
            paid: Number(loan_paid_today._sum.amount),
            due: Number(loan_due_today._sum.emi_amount),
          },
        },
        collection: Number(today_incoming._sum.amount),
        today_disburshed: Number(today_disburshed._sum.amount),
        wallet_balance: Number(balance._sum.balance),
      },
    };
  }

  @Get('assignments')
  async findAssignments(
    @Req() req,
    @Query('type') type: string,
    @Query('skip') skip: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    if (req.user.role !== 'Agent')
      throw new BadRequestException('Unauthorized');

    return this.usersService.findAssignments(
      req.user.id,
      type,
      parseInt(limit ?? '10'),
      parseInt(skip ?? '0'),
    );
  }
}
