import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchWorkspaceController } from './branch-workspace.controller';

@Module({
  imports: [AuthModule, AuthorizationModule, PrismaModule],
  controllers: [BranchWorkspaceController],
})
export class BranchWorkspaceModule {}
