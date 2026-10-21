import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('branches')
  @Header('Cache-Control', 'no-store')
  findBranches() {
    return this.catalogService.findBranches();
  }

  @Get('branches/:branchId/services')
  @Header('Cache-Control', 'no-store')
  findBranchServices(@Param('branchId', new ParseUUIDPipe()) branchId: string) {
    return this.catalogService.findBranchServices(branchId);
  }

  @Get('branches/:branchId/groomers')
  @Header('Cache-Control', 'no-store')
  findBranchGroomers(@Param('branchId', new ParseUUIDPipe()) branchId: string) {
    return this.catalogService.findBranchGroomers(branchId);
  }
}
