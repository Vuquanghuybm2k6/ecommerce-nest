import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService], // nestjs sẽ tự tạo một object từ class này
  exports: [UsersService, TypeOrmModule], // cho phép các module khác sd UsersService thông qua Dependency Injection
})
export class UsersModule {}
