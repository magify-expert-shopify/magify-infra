import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomerProblemCategoriesService } from './customer-problem-categories.service';
import {
  CreateCustomerProblemCategoryDto,
  UpdateCustomerProblemCategoryDto,
} from './dto';

@Controller('customer-problem-categories')
export class CustomerProblemCategoriesController {
  constructor(
    private readonly customerProblemCategoriesService: CustomerProblemCategoriesService,
  ) {}

  @Get()
  findAll() {
    return this.customerProblemCategoriesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCustomerProblemCategoryDto) {
    return this.customerProblemCategoriesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerProblemCategoryDto,
  ) {
    return this.customerProblemCategoriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerProblemCategoriesService.remove(id);
  }
}
