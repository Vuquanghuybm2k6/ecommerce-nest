import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slug from 'slug';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    if (dto.parentId) {
      const parent = await this.categoriesRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = this.categoriesRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      imageUrl: dto.imageUrl,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      parentId: dto.parentId,
    });

    return this.categoriesRepository.save(category);
  }

  async findAll() {
    const categories = await this.categoriesRepository.find({
      relations: ['children'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return categories.filter((c) => !c.parentId);
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      category.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    if (dto.parentId) {
      const parent = await this.categoriesRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
    }

    Object.assign(category, dto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    const childCount = await this.categoriesRepository.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${childCount} subcategories`,
      );
    }

    await this.categoriesRepository.softDelete(id);
    return { message: 'Category deleted successfully' };
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    let baseSlug = slug(name, { lower: true });
    let result = baseSlug;
    let suffix = 0;
    let existing = await this.categoriesRepository.findOne({ where: { slug: result } });
    while (existing && existing.id !== excludeId) {
      suffix++;
      result = `${baseSlug}-${suffix}`;
      existing = await this.categoriesRepository.findOne({ where: { slug: result } });
    }
    return result;
  }
}
