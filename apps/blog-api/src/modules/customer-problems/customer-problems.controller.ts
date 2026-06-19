import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomerProblemsService } from './customer-problems.service';
import { CreateCustomerProblemDto, UpdateCustomerProblemDto } from './dto';

@Controller('customer-problems')
export class CustomerProblemsController {
  constructor(
    private readonly customerProblemsService: CustomerProblemsService,
  ) {}

  @Get()
  findAll() {
    return this.customerProblemsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCustomerProblemDto) {
    return this.customerProblemsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerProblemsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerProblemDto) {
    return this.customerProblemsService.update(id, dto);
  }

  @Post(':id/extract-keywords')
  extractKeywords(@Param('id') id: string) {
    return this.customerProblemsService.extractKeywords(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerProblemsService.remove(id);
  }
}
