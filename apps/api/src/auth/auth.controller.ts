import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateCredentials(dto);

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error: unknown) => {
        if (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Failed to regenerate session'),
          );
          return;
        }

        resolve();
      });
    });

    req.session.userId = user.id;
    req.session.authVersion = user.authVersion;

    await new Promise<void>((resolve, reject) => {
      req.session.save((error: unknown) => {
        if (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Failed to save session'),
          );
          return;
        }

        resolve();
      });
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() req: AuthenticatedRequest) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.authService.getCurrentUserAccess(
      req.currentUser.id,
      req.session.authVersion,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieOptions = {
      path: req.session.cookie.path,
      httpOnly: req.session.cookie.httpOnly,
      secure: req.session.cookie.secure === true,
      sameSite: req.session.cookie.sameSite,
    };

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error: unknown) => {
        if (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Failed to destroy session'),
          );
          return;
        }

        resolve();
      });
    });

    res.clearCookie('petopia.sid', cookieOptions);
  }
}
