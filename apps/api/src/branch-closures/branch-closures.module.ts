import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchClosuresController } from './branch-closures.controller';
import { BranchClosuresService } from './branch-closures.service';

@Module({
  imports: [AuthModule, AuthorizationModule, PrismaModule],
  controllers: [BranchClosuresController],
  providers: [BranchClosuresService],
})
export class BranchClosuresModule {}
