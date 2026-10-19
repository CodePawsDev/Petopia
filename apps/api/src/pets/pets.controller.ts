import {
  Body,
  Controller,
  Header,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Get,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseBoolPipe,
  Query,
  Patch,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetsService } from './pets.service';
import { UpdatePetDto } from './dto/update-pet.dto';

@Controller('pets')
@UseGuards(SessionAuthGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreatePetDto, @Req() req: AuthenticatedRequest) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.create(req.currentUser.id, dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('archived', new DefaultValuePipe(false), new ParseBoolPipe())
    archived: unknown,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.findAll(req.currentUser.id, archived === true);
  }

  @Get(':petId')
  @Header('Cache-Control', 'no-store')
  findOne(
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.findOne(req.currentUser.id, petId);
  }

  @Post(':petId/archive')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  archive(
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.archive(req.currentUser.id, petId);
  }

  @Post(':petId/restore')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  restore(
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.restore(req.currentUser.id, petId);
  }
  @Patch(':petId')
  @Header('Cache-Control', 'no-store')
  update(
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Body() dto: UpdatePetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.petsService.update(req.currentUser.id, petId, dto);
  }
}
